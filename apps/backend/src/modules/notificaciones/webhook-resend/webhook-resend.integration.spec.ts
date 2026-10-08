import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../../test-utils/bootstrap-integration-app';
import { Notificacion } from '../../../database/entities';
import { NotificacionesService } from '../notificaciones.service';
import { ResendService } from '../providers/resend.service';

/** Secreto de PRUEBA generado en cada corrida (formato de Resend: "whsec_" + base64). */
const SECRETO = `whsec_${randomBytes(24).toString('base64')}`;
/** Id que el doble de Resend "devuelve" al enviar; los eventos lo traen como data.email_id. */
const ID_CORREO = randomUUID();
const PATRON_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Firma como lo hace Svix, calculada aquí a mano con node:crypto (no con el
 * SDK que usa el servidor), así la prueba también valida el formato:
 * base64(HMAC-SHA256(clave, `${id}.${timestamp}.${body}`)), clave = base64
 * después de "whsec_", header "v1,<firma>".
 */
function firmar(cuerpo: string, id: string, timestamp: number, secreto = SECRETO) {
  const clave = Buffer.from(secreto.slice('whsec_'.length), 'base64');
  const firma = createHmac('sha256', clave).update(`${id}.${timestamp}.${cuerpo}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${firma}` };
}

function evento(type: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: ID_CORREO,
      created_at: new Date().toISOString(),
      from: 'Turnify <onboarding@resend.dev>',
      to: ['cliente-webhook@example.com'],
      subject: 'Reserva confirmada',
      ...extra,
    },
  });
}

const ahora = () => Math.floor(Date.now() / 1000);

/**
 * Frente 4: webhook de Resend con app y BD reales. Resend se reemplaza por
 * un doble (no se envía ningún correo); los eventos se firman aquí con un
 * secreto de prueba.
 */
describe('POST /webhooks/resend (integración HTTP real)', () => {
  let app: INestApplication;
  let token: string;
  let idNotificacion: string;
  const secretoAnterior = process.env.RESEND_WEBHOOK_SECRET;

  const http = () => request(app.getHttpServer());
  const enviarWebhook = (cuerpo: string, headers: Record<string, string>) =>
    http().post('/webhooks/resend').set('Content-Type', 'application/json').set(headers).send(cuerpo);
  const notificacionActual = async () => {
    const res = await http().get('/notificaciones').set('Authorization', `Bearer ${token}`).expect(200);
    return { item: res.body.data[0], cuerpo: JSON.stringify(res.body) };
  };

  beforeAll(async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRETO;
    app = await bootstrapIntegrationApp((b) =>
      b.overrideProvider(ResendService).useValue({
        enviarCorreo: async () => ({ exito: true, idProveedor: ID_CORREO }),
      }),
    );
    const s = Date.now();
    const reg = await http()
      .post('/auth/registro')
      .send({
        nombreNegocio: `Negocio Webhook IT ${s}`,
        tipoNegocio: 'otro',
        correoNegocio: `it-webhook-negocio-${s}@example.com`,
        nombreCompletoAdmin: 'Admin Webhook IT',
        correoAdmin: `it-webhook-admin-${s}@example.com`,
        contrasena: 'Turnify123!',
      });
    token = reg.body.tokens.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    const idUsuario = reg.body.usuario.idUsuario;
    const servicio = await http()
      .post('/servicios')
      .set(auth)
      .send({ nombre: 'Servicio Webhook IT', duracionMinutos: 30, precio: 5000 });
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
        nombreCompleto: 'Cliente Webhook IT',
        correoElectronico: `it-webhook-cliente-${s}@example.com`,
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

    // Solo la notificación de esta reserva, con el mismo método del worker.
    const repo = app.get<Repository<Notificacion>>(getRepositoryToken(Notificacion));
    const notificacion = await repo.findOneOrFail({
      where: { idReserva: reserva.body.idReserva },
      relations: { cliente: true },
    });
    await (app.get(NotificacionesService) as any).enviarUna(notificacion);
    idNotificacion = notificacion.idNotificacion;
  }, 60_000);

  afterAll(async () => {
    if (secretoAnterior === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = secretoAnterior;
    await app?.close();
  });

  it('al enviar se guarda el id del correo de Resend', async () => {
    const repo = app.get<Repository<Notificacion>>(getRepositoryToken(Notificacion));
    const n = await repo.findOneByOrFail({ idNotificacion });
    expect(n.idCorreoProveedor).toBe(ID_CORREO);
    expect(n.estado).toBe('enviada');
  });

  it('firma inválida (otro secreto) → 400 WEBHOOK_FIRMA_INVALIDA y no cambia nada', async () => {
    const cuerpo = evento('email.delivered');
    const otroSecreto = `whsec_${randomBytes(24).toString('base64')}`;
    const res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora(), otroSecreto));
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('WEBHOOK_FIRMA_INVALIDA');
    expect((await notificacionActual()).item.estado).toBe('enviada');
  });

  it('body alterado después de firmar → 400', async () => {
    const cuerpo = evento('email.delivered');
    const headers = firmar(cuerpo, `msg_${randomUUID()}`, ahora());
    const res = await enviarWebhook(cuerpo.replace('Reserva', 'Reservá'), headers);
    expect(res.status).toBe(400);
  });

  it('sin headers de Svix → 400', async () => {
    const res = await enviarWebhook(evento('email.delivered'), {});
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('WEBHOOK_FIRMA_INVALIDA');
  });

  it('timestamp vencido (10 min atrás), aunque la firma sea correcta → 400', async () => {
    const cuerpo = evento('email.delivered');
    const res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora() - 600));
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('WEBHOOK_FIRMA_INVALIDA');
    expect((await notificacionActual()).item.estado).toBe('enviada');
  });

  it('firma válida: email.delivery_delayed y luego email.delivered actualizan el historial', async () => {
    let cuerpo = evento('email.delivery_delayed');
    let res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora()));
    expect(res.status).toBe(200);
    expect(res.body.resultado).toBe('procesado');
    let { item } = await notificacionActual();
    expect(item.estado).toBe('enviada');
    expect(item.ultimoError).toBe('ENTREGA_DEMORADA');

    cuerpo = evento('email.delivered');
    res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora()));
    expect(res.status).toBe(200);
    ({ item } = await notificacionActual());
    expect(item.estado).toBe('entregada');
    expect(item.ultimoError).toBeNull();
  });

  it('email.bounced: fallida con categoría saneada; el texto del rebote (con un correo) no llega a la API', async () => {
    const cuerpo = evento('email.bounced', {
      bounce: {
        type: 'Permanent',
        subType: 'General',
        message: 'The email account that you tried to reach does not exist: cliente-webhook@example.com',
      },
    });
    const res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora()));
    expect(res.status).toBe(200);
    const { item, cuerpo: respuesta } = await notificacionActual();
    expect(item.estado).toBe('fallida');
    expect(item.ultimoError).toBe('REBOTE_PERMANENTE');
    expect(respuesta).not.toContain('does not exist');
    expect(respuesta.match(PATRON_CORREO)).toBeNull();
  });

  it('evento repetido (mismo svix-id) → 200 "duplicado", se registra una sola vez y no se reaplica', async () => {
    const idMensaje = `msg_${randomUUID()}`;
    const cuerpo = evento('email.complained');
    const primera = await enviarWebhook(cuerpo, firmar(cuerpo, idMensaje, ahora()));
    expect(primera.status).toBe(200);
    // Tras el rebote, la queja sí aplica (implica entrega).
    expect(primera.body.resultado).toBe('procesado');
    expect((await notificacionActual()).item.ultimoError).toBe('MARCADO_COMO_SPAM');

    // Se cambia el estado por otro camino para detectar una reaplicación.
    const repo = app.get<Repository<Notificacion>>(getRepositoryToken(Notificacion));
    await repo.update({ idNotificacion }, { estado: 'fallida' as never, ultimoError: 'REBOTE_TEMPORAL' });

    const segunda = await enviarWebhook(cuerpo, firmar(cuerpo, idMensaje, ahora()));
    expect(segunda.status).toBe(200);
    expect(segunda.body.resultado).toBe('duplicado');
    expect((await notificacionActual()).item.ultimoError).toBe('REBOTE_TEMPORAL');

    const filas: unknown[] = await app
      .get(DataSource)
      .query(`SELECT 1 FROM "webhook_eventos_procesados" WHERE "id_mensaje" = $1`, [idMensaje]);
    expect(filas).toHaveLength(1);
  });

  it('evento firmado de un correo que no es de ninguna notificación → 200 "ignorado"', async () => {
    const cuerpo = JSON.stringify({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: randomUUID() },
    });
    const res = await enviarWebhook(cuerpo, firmar(cuerpo, `msg_${randomUUID()}`, ahora()));
    expect(res.status).toBe(200);
    expect(res.body.resultado).toBe('ignorado');
  });
});
