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
}
