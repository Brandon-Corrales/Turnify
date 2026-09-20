import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../test-utils/bootstrap-integration-app';

/**
 * QA — cobertura de los límites freemium del Plan Gratis (punto 5.1 del
 * brief): ya se habían verificado de punta a punta el límite de 3
 * servicios activos y el bloqueo de WhatsApp (tarjeta del Toggle) y el
 * límite de 10 mensajes/día del chatbot (tarjeta de rate limiting) —
 * pero el límite de **20 reservas por mes calendario** nunca se probó
 * de verdad end-to-end. `limite-plan-gratis.guard.spec.ts` sí tiene un
 * test unitario para 'reservas' (con `LimitesPlanService` mockeado),
 * pero eso solo prueba que el guard LEE el conteo correctamente — nunca
 * prueba que `LimitesPlanService.contar('reservas', ...)` arme el query
 * real correcto contra la base real, ni que crear una reserva 21 falle
 * de verdad a través de todo el pipeline HTTP.
 *
 * Este test crea 20 reservas REALES (vía `POST /reservas` real, mismo
 * negocio Plan Gratis desde que se registra) y confirma que la 21 es
 * rechazada por el guard real con el error real — la única forma de
 * probar el límite de verdad, no solo que el número "20" está bien
 * escrito en algún lado.
 */
describe('Límite freemium: 20 reservas/mes en Plan Gratis (integración HTTP real)', () => {
  let app: INestApplication;
  let accessToken: string;
  let idUsuario: string;
  let idServicio: string;
  let idCliente: string;

  /** 20 slots de 30 min espaciados 40 min entre sí, el mismo día futuro, todos dentro de la disponibilidad 00:00–23:00. */
  function horarioIndice(i: number): string {
    const fecha = new Date();
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    fecha.setUTCHours(14, 0, 0, 0); // 08:00 hora Costa Rica (UTC-6)
    fecha.setUTCMinutes(fecha.getUTCMinutes() + i * 40);
    return fecha.toISOString();
  }

  beforeAll(async () => {
    app = await bootstrapIntegrationApp();

    const sufijo = Date.now();
    const registro = await request(app.getHttpServer())
      .post('/auth/registro')
      .send({
        nombreNegocio: `Negocio Limite Reservas IT ${sufijo}`,
        tipoNegocio: 'barberia',
        correoNegocio: `it-limite-negocio-${sufijo}@example.com`,
        nombreCompletoAdmin: 'Admin Limite IT',
        correoAdmin: `it-limite-admin-${sufijo}@example.com`,
        contrasena: 'Turnify123!',
      });
    accessToken = registro.body.tokens.accessToken;
    idUsuario = registro.body.usuario.idUsuario;

    const servicio = await request(app.getHttpServer())
      .post('/servicios')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ nombre: 'Corte Límite IT', duracionMinutos: 30, precio: 5000 });
    idServicio = servicio.body.idServicio;

    for (let diaSemana = 0; diaSemana <= 6; diaSemana++) {
      await request(app.getHttpServer())
        .post('/disponibilidad')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idUsuario, diaSemana, horaInicio: '00:00', horaFin: '23:00' });
    }

    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        nombreCompleto: 'Cliente Límite IT',
        correoElectronico: `it-limite-cliente-${sufijo}@example.com`,
      });
    idCliente = cliente.body.idCliente;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('un negocio nuevo en Plan Gratis puede crear las primeras 20 reservas del mes sin bloqueo', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app.getHttpServer())
        .post('/reservas')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: horarioIndice(i) });

      expect(
        res.status,
        `reserva #${i + 1} debería crearse (respuesta: ${JSON.stringify(res.body)})`,
      ).toBe(201);
    }
  }, 30_000);

  it('la reserva número 21 del mismo mes es rechazada con 403 LIMITE_PLAN_ALCANZADO', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: horarioIndice(20) })
      .expect(403);

    expect(res.body.errorCode).toBe('LIMITE_PLAN_ALCANZADO');
  });
});
