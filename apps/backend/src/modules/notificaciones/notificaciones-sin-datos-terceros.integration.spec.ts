import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../test-utils/bootstrap-integration-app';
import { Notificacion } from '../../database/entities';
import { NotificacionesService } from './notificaciones.service';
import { ResendService } from './providers/resend.service';
import { clasificarRechazoProveedor } from './motivo-fallo';

/** Correo de la "persona dueña de la cuenta de Resend" en el texto del proveedor. */
const CORREO_DUENA_CUENTA = 'duena.cuenta.resend@cuenta-del-equipo.test';
const TEXTO_CRUDO_RESEND = `You can only send testing emails to your own email address (${CORREO_DUENA_CUENTA}). To send emails to other recipients, please verify a domain at resend.com/domains, and change the \`from\` address to an email using this domain.`;
const PATRON_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Frente 2 del Seguimiento #3: ninguna respuesta de la API de
 * Notificaciones para el admin de un negocio puede contener el correo de la
 * dueña de la cuenta de Resend ni ningún otro correo. App y BD reales; solo
 * Resend se reemplaza por un doble que devuelve el texto real del sandbox
 * (para no llamar al proveedor ni escribirle a nadie).
 */
describe('Notificaciones: el motivo de fallo no expone datos de terceros (integración HTTP real)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapIntegrationApp((b) =>
      b.overrideProvider(ResendService).useValue({
        enviarCorreo: async () => ({
          exito: false,
          error: TEXTO_CRUDO_RESEND,
          motivo: clasificarRechazoProveedor(TEXTO_CRUDO_RESEND),
        }),
      }),
    );
    const s = Date.now();
    const http = () => request(app.getHttpServer());
    const reg = await http()
      .post('/auth/registro')
      .send({
        nombreNegocio: `Negocio Terceros IT ${s}`,
        tipoNegocio: 'otro',
        correoNegocio: `it-terceros-negocio-${s}@example.com`,
        nombreCompletoAdmin: 'Admin Terceros IT',
        correoAdmin: `it-terceros-admin-${s}@example.com`,
        contrasena: 'Turnify123!',
      });
    token = reg.body.tokens.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    const idUsuario = reg.body.usuario.idUsuario;
    const servicio = await http()
      .post('/servicios')
      .set(auth)
      .send({ nombre: 'Servicio Terceros IT', duracionMinutos: 30, precio: 5000 });
    for (let dia = 0; dia <= 6; dia++) {
      await http()
        .post('/disponibilidad')
        .set(auth)
        .send({ idUsuario, diaSemana: dia, horaInicio: '00:00', horaFin: '23:00' });
    }
    const cliente = await http()
      .post('/clientes')
      .set(auth)
      .send({
        nombreCompleto: 'Cliente Terceros IT',
        correoElectronico: `it-terceros-cliente-${s}@example.com`,
      });
    const inicio = new Date();
    inicio.setUTCDate(inicio.getUTCDate() + 1);
    inicio.setUTCHours(16, 0, 0, 0);
    const reserva = await http().post('/reservas').set(auth).send({
      idCliente: cliente.body.idCliente,
      idServicio: servicio.body.idServicio,
      idUsuario,
      fechaHoraInicio: inicio.toISOString(),
    });

    // Se intenta enviar SOLO la notificación de esta reserva (no todo el lote
    // pendiente de la BD de desarrollo), con el mismo método que usa el worker.
    const repo = app.get<Repository<Notificacion>>(getRepositoryToken(Notificacion));
    const notificacion = await repo.findOneOrFail({
      where: { idReserva: reserva.body.idReserva },
      relations: { cliente: true },
    });
    await (app.get(NotificacionesService) as any).enviarUna(notificacion);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('el historial trae la categoría y ningún correo (ni el de la dueña de la cuenta de Resend)', async () => {
    const res = await request(app.getHttpServer())
      .get('/notificaciones')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const cuerpo = JSON.stringify(res.body);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ultimoError).toBe('DESTINATARIO_NO_HABILITADO');
    expect(cuerpo).not.toContain(CORREO_DUENA_CUENTA);
    expect(cuerpo).not.toContain('testing emails');
    expect(cuerpo.match(PATRON_CORREO)).toBeNull();
  });
});
