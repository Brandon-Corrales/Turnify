import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import type { ResultadoEnvio } from './resend.service';

/**
 * Versión de Graph API vigente al momento de escribir esto (verificada en
 * developers.facebook.com, no asumida de memoria) — reemplaza Twilio
 * Sandbox porque el equipo no pudo verificar su cuenta de Twilio.
 */
const GRAPH_API_VERSION = 'v26.0';

/**
 * Envoltorio inyectable sobre la Cloud API de WhatsApp de Meta (REST
 * simple, sin SDK oficial de Node — un solo POST con fetch nativo es
 * suficiente y evita una dependencia externa no verificada). Mismo patrón
 * que ResendService: mockeable en tests, nunca llama a la API real desde
 * un test unitario.
 *
 * **Limitación real de la plataforma (no un bug de Turnify), verificada
 * en pruebas de envío reales**: un mensaje de texto libre como este solo
 * se entrega si el destinatario le escribió primero al número de negocio
 * en las últimas 24 horas (la "ventana de servicio al cliente" de
 * WhatsApp Business). Un cliente que reserva por primera vez sin haberle
 * escrito nunca al negocio por WhatsApp NO puede recibir texto libre —
 * solo un mensaje de una plantilla pre-aprobada por Meta. Turnify
 * necesitará plantillas de WhatsApp aprobadas (fuera del alcance de esta
 * tarjeta) para que confirmaciones/recordatorios lleguen también a esos
 * clientes; por ahora, fuera de la ventana de 24h, `enviarMensaje` falla
 * con el error de Graph API y el worker lo reintenta según
 * MAX_REINTENTOS en NotificacionesService hasta marcarlo FALLIDA.
 */
@Injectable()
export class WhatsappCloudApiService {
  private readonly logger = new Logger(WhatsappCloudApiService.name);
  private readonly accessToken?: string;
  private readonly idNumeroTelefono?: string;

  constructor(config: ConfigService<Env, true>) {
    this.accessToken = config.get('WHATSAPP_ACCESS_TOKEN', { infer: true });
    this.idNumeroTelefono = config.get('WHATSAPP_PHONE_NUMBER_ID', { infer: true });
  }

  async enviarMensaje(telefonoDestino: string, mensaje: string): Promise<ResultadoEnvio> {
    if (!this.accessToken || !this.idNumeroTelefono) {
      return {
        exito: false,
        error: 'WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados',
      };
    }

    const respuesta = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.idNumeroTelefono}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: telefonoDestino,
          type: 'text',
          text: { body: mensaje },
        }),
      },
    );

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      this.logger.warn(
        `Envío de WhatsApp a ${telefonoDestino} falló (${respuesta.status}): ${cuerpo}`,
      );
      return { exito: false, error: `Graph API ${respuesta.status}: ${cuerpo}` };
    }
    return { exito: true };
  }
}
