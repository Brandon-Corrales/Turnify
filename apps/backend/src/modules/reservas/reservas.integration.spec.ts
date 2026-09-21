import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../test-utils/bootstrap-integration-app';

/**
 * Tests de INTEGRACIÓN reales (punto 19/QA del brief): a diferencia de
 * `reservas.service.spec.ts` (instancia `ReservasService` a mano con
 * mocks), esto levanta la app completa (`AppModule` real) y dispara
 * requests HTTP reales con `supertest` — guards globales, interceptor
 * multi-tenant, `ValidationPipe`, `AllExceptionsFilter` y TypeORM contra
 * la base real, todo en el camino real que recorrería un cliente.
 *
 * Negocio/servicio/disponibilidad/cliente se crean vía la API real en
 * `beforeAll` (con sufijo de timestamp) — mismo criterio que el E2E de
 * Playwright: aislado, repetible, no depende de datos de seed
 * compartidos. Disponibilidad amplia (00:00–23:00, 7 días) y un horario
 * fijo del día siguiente a las 09:00 hora Costa Rica para no depender
 * de la hora del día en que corre el test.
 */
describe('Reservas (integración HTTP real)', () => {
  let app: INestApplication;
  let accessToken: string;
  let idUsuario: string;
  let idServicio: string;
  let idCliente: string;
  let idReservaCreada: string;

  function manana9amCR(): string {
    const manana = new Date();
    manana.setUTCDate(manana.getUTCDate() + 1);
    // 09:00 hora Costa Rica (UTC-6) = 15:00 UTC — bien dentro de la
    // disponibilidad 00:00–23:00 registrada abajo, sin importar el día.
    manana.setUTCHours(15, 0, 0, 0);
    return manana.toISOString();
  }

  beforeAll(async () => {
    app = await bootstrapIntegrationApp();

    const sufijo = Date.now();
    const registro = await request(app.getHttpServer())
      .post('/auth/registro')
      .send({
        nombreNegocio: `Negocio Reservas IT ${sufijo}`,
        tipoNegocio: 'barberia',
        correoNegocio: `it-reservas-negocio-${sufijo}@example.com`,
        nombreCompletoAdmin: 'Admin Reservas IT',
        correoAdmin: `it-reservas-admin-${sufijo}@example.com`,
        contrasena: 'Turnify123!',
      });
    accessToken = registro.body.tokens.accessToken;
    idUsuario = registro.body.usuario.idUsuario;

    const servicio = await request(app.getHttpServer())
      .post('/servicios')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ nombre: 'Corte IT', duracionMinutos: 30, precio: 5000 });
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
        nombreCompleto: 'Cliente Reservas IT',
        correoElectronico: `it-cliente-${sufijo}@example.com`,
      });
    idCliente = cliente.body.idCliente;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('POST /reservas sin Authorization responde 401', async () => {
    await request(app.getHttpServer())
      .post('/reservas')
      .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: manana9amCR() })
      .expect(401);
  });

  it('POST /reservas rechaza una fecha en el pasado con 400 FECHA_EN_EL_PASADO', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: '2020-01-01T15:00:00.000Z' })
      .expect(400);
    expect(res.body.errorCode).toBe('FECHA_EN_EL_PASADO');
  });

  it('POST /reservas con datos reales y horario disponible crea la reserva de verdad', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: manana9amCR() })
      .expect(201);

    expect(res.body.idReserva).toEqual(expect.any(String));
    expect(res.body.estado).toBe('confirmada');
    idReservaCreada = res.body.idReserva;
  });

  it('POST /reservas en el MISMO horario para el mismo usuario responde 409 RESERVA_TRASLAPADA', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ idCliente, idServicio, idUsuario, fechaHoraInicio: manana9amCR() })
      .expect(409);
    expect(res.body.errorCode).toBe('RESERVA_TRASLAPADA');
  });

  it('GET /reservas incluye la reserva recién creada, con las relaciones cliente/servicio/usuario', async () => {
    const res = await request(app.getHttpServer())
      .get('/reservas?limit=100')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const creada = res.body.data.find(
      (r: { idReserva: string }) => r.idReserva === idReservaCreada,
    );
    expect(creada).toBeTruthy();
    expect(creada.cliente.idCliente).toBe(idCliente);
    expect(creada.servicio.idServicio).toBe(idServicio);
  });

  it('GET /reservas/:id de una reserva inexistente responde 404 RESERVA_NO_ENCONTRADA', async () => {
    const res = await request(app.getHttpServer())
      .get('/reservas/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    expect(res.body.errorCode).toBe('RESERVA_NO_ENCONTRADA');
  });

  it('PATCH /reservas/:id/cancelar cancela la reserva de verdad', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/reservas/${idReservaCreada}/cancelar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.estado).toBe('cancelada');
  });

  it('PATCH /reservas/:id/cancelar sobre una reserva ya cancelada responde 409 RESERVA_YA_CANCELADA', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/reservas/${idReservaCreada}/cancelar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
    expect(res.body.errorCode).toBe('RESERVA_YA_CANCELADA');
  });

  it('PATCH /reservas/:id/reprogramar sobre una reserva cancelada responde 409 RESERVA_CANCELADA', async () => {
    const otroHorario = new Date(manana9amCR());
    otroHorario.setUTCHours(otroHorario.getUTCHours() + 2);
    const res = await request(app.getHttpServer())
      .patch(`/reservas/${idReservaCreada}/reprogramar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fechaHoraInicio: otroHorario.toISOString() })
      .expect(409);
    expect(res.body.errorCode).toBe('RESERVA_CANCELADA');
  });
});
