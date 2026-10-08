import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../../../config/env.schema';
import { clasificarRechazoProveedor, MotivoFallo } from '../motivo-fallo';

export interface ResultadoEnvio {
  exito: boolean;
  /** Texto crudo, SOLO para el log del servidor (puede traer datos de terceros). */
  error?: string;
  /** Categoría saneada: lo único que se guarda en BD y sale por la API. */
  motivo?: MotivoFallo;
  /** Id del mensaje en el proveedor (Resend: `data.id`), para cruzarlo con sus webhooks. */
  idProveedor?: string;
}

/**
 * Envoltorio inyectable sobre el SDK de Resend (clase, no funciones
 * sueltas) para poder mockearlo en tests sin llamar a la API real —
 * mismo patrón de "capa de infraestructura aislada" del punto 14 del
 * brief.
 */
@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly cliente: Resend | null;
  private readonly remitente: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.cliente = apiKey ? new Resend(apiKey) : null;
    this.remitente = config.get('RESEND_FROM_EMAIL', { infer: true });
  }

  async enviarCorreo(destinatario: string, asunto: string, html: string): Promise<ResultadoEnvio> {
    if (!this.cliente) {
      return {
        exito: false,
        error: 'RESEND_API_KEY no configurada',
        motivo: MotivoFallo.CREDENCIALES_FALTANTES,
      };
    }
    const { data, error } = await this.cliente.emails.send({
      from: this.remitente,
      to: [destinatario],
      subject: asunto,
      html,
    });
    if (error) {
      this.logger.warn(`Envío de correo a ${destinatario} falló: ${error.message}`);
      return {
        exito: false,
        error: error.message,
        motivo: clasificarRechazoProveedor(error.message),
      };
    }
    return { exito: true, idProveedor: data?.id };
  }
}
