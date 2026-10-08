import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';

/**
 * Registro de mensajes de webhook ya procesados, para que un reenvío no se
 * aplique dos veces. Resend entrega sus webhooks con Svix, y el header
 * `svix-id` "is unique across all messages, but will be the same when the
 * same webhook is being resent" (docs de Svix): por eso es la clave
 * primaria. Tabla técnica, sin id_negocio (el webhook no corre dentro de
 * un tenant).
 */
@Entity('webhook_eventos_procesados')
export class WebhookEventoProcesado extends AuditableEntity {
  @PrimaryColumn({ name: 'id_mensaje', type: 'varchar', length: 255 })
  idMensaje!: string;

  @Column({ name: 'proveedor', type: 'varchar', length: 32 })
  proveedor!: string;

  @Column({ name: 'tipo_evento', type: 'varchar', length: 64 })
  tipoEvento!: string;
}
