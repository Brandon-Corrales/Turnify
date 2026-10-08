import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';
import { CanalNotificacion, EstadoNotificacion, TipoNotificacion } from './enums';
import { Reserva } from './reserva.entity';
import { Cliente } from './cliente.entity';

@Entity('notificaciones')
export class Notificacion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_notificacion' })
  idNotificacion!: string;

  @Index()
  @Column({ name: 'id_reserva', type: 'uuid' })
  idReserva!: string;

  @ManyToOne(() => Reserva, (reserva) => reserva.notificaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_reserva' })
  reserva!: Reserva;

  @Index()
  @Column({ name: 'id_cliente', type: 'uuid' })
  idCliente!: string;

  @ManyToOne(() => Cliente, (cliente) => cliente.notificaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cliente' })
  cliente!: Cliente;

  @Column({ name: 'tipo', type: 'enum', enum: TipoNotificacion })
  tipo!: TipoNotificacion;

  @Column({ name: 'canal', type: 'enum', enum: CanalNotificacion })
  canal!: CanalNotificacion;

  @Index()
  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoNotificacion,
    default: EstadoNotificacion.PENDIENTE,
  })
  estado!: EstadoNotificacion;

  @Index()
  @Column({ name: 'programado_para', type: 'timestamptz' })
  programadoPara!: Date;

  @Column({ name: 'enviado_en', type: 'timestamptz', nullable: true })
  enviadoEn?: Date | null;

  @Column({ name: 'mensaje', type: 'text' })
  mensaje!: string;

  @Column({ name: 'reintentos', type: 'int', default: 0 })
  reintentos!: number;

  /**
   * Motivo del último intento fallido, como CATEGORÍA (`MotivoFallo`, ver
   * `modules/notificaciones/motivo-fallo.ts`), nunca el texto crudo del
   * proveedor (puede traer datos de terceros; ese texto solo va al log).
   * Se limpia al enviarse bien.
   */
  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError?: string | null;

  /**
   * Id que devuelve el proveedor al aceptar el envío (`data.id` de
   * `resend.emails.send`). Los webhooks de Resend lo traen como
   * `data.email_id` y es lo único que permite saber a qué notificación se
   * refiere un rebote o una entrega.
   */
  @Index()
  @Column({ name: 'id_correo_proveedor', type: 'varchar', length: 255, nullable: true })
  idCorreoProveedor?: string | null;
}
