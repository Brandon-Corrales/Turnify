import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../test-utils/bootstrap-integration-app';

/**
 * Regresión del bug 1 de la prueba de humo del Seguimiento #3: el
 * onboarding mandaba 4 `POST /servicios` en paralelo y los 4 pasaban
 * `LimitePlanGratisGuard` (contaba antes de que ninguno insertara),
 * dejando 4 servicios activos en Plan Gratis (límite: 3).
 *
 * Aquí las requests salen de verdad en paralelo contra la app y la base
 * reales: el límite tiene que sostenerse por el chequeo atómico
 * (`LimitesPlanService.asegurarDentroDelLimite`, advisory lock por
 * negocio dentro de la transacción del INSERT), no por el guard.
 */
describe('Límites del Plan Gratis bajo requests concurrentes (integración HTTP real)', () => {
  let app: INestApplication;
  let accessToken: string;
  let idUsuario: string;

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  beforeAll(async () => {
    app = await bootstrapIntegrationApp();
    const sufijo = Date.now();
    const registro = await request(app.getHttpServer())
      .post('/auth/registro')
      .send({
        nombreNegocio: `Negocio Concurrencia IT ${sufijo}`,
        tipoNegocio: 'barberia',
        correoNegocio: `it-concurrencia-negocio-${sufijo}@example.com`,
        nombreCompletoAdmin: 'Admin Concurrencia IT',
        correoAdmin: `it-concurrencia-admin-${sufijo}@example.com`,
        contrasena: 'Turnify123!',
      });
    accessToken = registro.body.tokens.accessToken;
    idUsuario = registro.body.usuario.idUsuario;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('6 POST /servicios simultáneos → exactamente 3 creados y 3 con LIMITE_PLAN_ALCANZADO', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app.getHttpServer())
          .post('/servicios')
          .set(auth())
          .send({ nombre: `Servicio paralelo ${i}`, duracionMinutos: 30, precio: 5000 }),
      ),
    );

    const creados = respuestas.filter((r) => r.status === 201);
    const bloqueados = respuestas.filter((r) => r.status === 403);
    expect(creados).toHaveLength(3);
    expect(bloqueados).toHaveLength(3);
    for (const r of bloqueados) expect(r.body.errorCode).toBe('LIMITE_PLAN_ALCANZADO');

    const listado = await request(app.getHttpServer()).get('/servicios').set(auth());
    expect(listado.body.total).toBe(3);
    expect(listado.body.data.every((s: { activo: boolean }) => s.activo)).toBe(true);
  }, 30_000);

  it('23 POST /reservas simultáneos → exactamente 20 creadas en el mes (límite del Plan Gratis)', async () => {
    const listado = await request(app.getHttpServer()).get('/servicios').set(auth());
    const idServicio = listado.body.data[0].idServicio as string;

    for (let diaSemana = 0; diaSemana <= 6; diaSemana++) {
      await request(app.getHttpServer())
        .post('/disponibilidad')
        .set(auth())
        .send({ idUsuario, diaSemana, horaInicio: '00:00', horaFin: '23:00' });
    }
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set(auth())
      .send({
        nombreCompleto: 'Cliente Concurrencia IT',
        correoElectronico: `it-concurrencia-cliente-${Date.now()}@example.com`,
      });

    // 23 slots consecutivos de 30 min sin traslape, el mismo día futuro, de 08:00 a 19:30 CR.
    const horario = (i: number) => {
      const fecha = new Date();
      fecha.setUTCDate(fecha.getUTCDate() + 1);
      fecha.setUTCHours(14, 0, 0, 0);
      fecha.setUTCMinutes(fecha.getUTCMinutes() + i * 30);
      return fecha.toISOString();
    };

    const respuestas = await Promise.all(
      Array.from({ length: 23 }, (_, i) =>
        request(app.getHttpServer())
          .post('/reservas')
          .set(auth())
          .send({
            idCliente: cliente.body.idCliente,
            idServicio,
            idUsuario,
            fechaHoraInicio: horario(i),
          }),
      ),
    );

    const creadas = respuestas.filter((r) => r.status === 201);
    const bloqueadas = respuestas.filter((r) => r.status === 403);
    expect(creadas).toHaveLength(20);
    expect(bloqueadas).toHaveLength(3);
    for (const r of bloqueadas) expect(r.body.errorCode).toBe('LIMITE_PLAN_ALCANZADO');
  }, 60_000);
});
