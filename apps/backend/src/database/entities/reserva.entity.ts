import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditableEntity } from './base.entity';
import { EstadoReserva, OrigenReserva } from './enums';
import { Negocio } from './negocio.entity';
import { Cliente } from './cliente.entity';
import { Servicio } from './servicio.entity';
import { Usuario } from './usuario.entity';
import { Notificacion } from './notificacion.entity';

/**
 * FKs en cascada (onDelete: CASCADE): el flujo normal de borrado de
 * NEGOCIO/USUARIO/CLIENTE/SERVICIO es soft-delete (ver esas entidades), así
 * que esto es una red de seguridad para un borrado físico real (ej. purga
 * GDPR de un negocio), no el camino habitual.
 */
@Entity('reservas')
@Index('idx_reserva_usuario_horario', ['idUsuario', 'fechaHoraInicio', 'fechaHoraFin'])
export class Reserva extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_reserva' })
  idReserva!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.reservas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  @Index()
  @Column({ name: 'id_cliente', type: 'uuid' })
  idCliente!: string;

  @ManyToOne(() => Cliente, (cliente) => cliente.reservas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cliente' })
  cliente!: Cliente;

  @Index()
  @Column({ name: 'id_servicio', type: 'uuid' })
  idServicio!: string;

  @ManyToOne(() => Servicio, (servicio) => servicio.reservas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_servicio' })
  servicio!: Servicio;

  @Index()
  @Column({ name: 'id_usuario', type: 'uuid' })
  idUsuario!: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.reservas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;

  @Column({ name: 'fecha_hora_inicio', type: 'timestamptz' })
  fechaHoraInicio!: Date;

  @Column({ name: 'fecha_hora_fin', type: 'timestamptz' })
  fechaHoraFin!: Date;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoReserva,
    default: EstadoReserva.PENDIENTE,
  })
  estado!: EstadoReserva;

  @Column({ name: 'notas', type: 'text', nullable: true })
  notas?: string;

  @Column({ name: 'origen', type: 'enum', enum: OrigenReserva, default: OrigenReserva.ONLINE })
  origen!: OrigenReserva;

  @OneToMany(() => Notificacion, (notificacion) => notificacion.reserva)
  notificaciones?: Notificacion[];
}
