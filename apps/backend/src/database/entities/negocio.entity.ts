import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditableEntity } from './base.entity';
import { PlanSuscripcion } from './enums';
import { Usuario } from './usuario.entity';
import { Cliente } from './cliente.entity';
import { Servicio } from './servicio.entity';
import { Reserva } from './reserva.entity';
import { Disponibilidad } from './disponibilidad.entity';
import { Suscripcion } from './suscripcion.entity';

/**
 * Índice único parcial (solo `eliminado_en IS NULL`): un negocio
 * soft-deleted libera su correo para que un negocio nuevo lo reuse.
 */
@Entity('negocios')
@Index('uq_negocio_correo_activo', ['correoElectronico'], {
  unique: true,
  where: '"eliminado_en" IS NULL',
})
export class Negocio extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_negocio' })
  idNegocio!: string;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ name: 'tipo_negocio', type: 'varchar', length: 100 })
  tipoNegocio!: string;

  @Column({ name: 'correo_electronico', type: 'varchar', length: 255 })
  correoElectronico!: string;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono?: string;

  @Column({ name: 'direccion', type: 'varchar', length: 255, nullable: true })
  direccion?: string;

  @Column({
    name: 'plan_suscripcion',
    type: 'enum',
    enum: PlanSuscripcion,
    default: PlanSuscripcion.GRATIS,
  })
  planSuscripcion!: PlanSuscripcion;

  @Column({ name: 'estado', type: 'varchar', length: 30, default: 'activo' })
  estado!: string;

  @Column({ name: 'fecha_registro', type: 'timestamptz', default: () => 'now()' })
  fechaRegistro!: Date;

  @DeleteDateColumn({ name: 'eliminado_en', type: 'timestamptz', nullable: true })
  eliminadoEn?: Date | null;

  @OneToMany(() => Usuario, (usuario) => usuario.negocio)
  usuarios?: Usuario[];

  @OneToMany(() => Cliente, (cliente) => cliente.negocio)
  clientes?: Cliente[];

  @OneToMany(() => Servicio, (servicio) => servicio.negocio)
  servicios?: Servicio[];

  @OneToMany(() => Reserva, (reserva) => reserva.negocio)
  reservas?: Reserva[];

  @OneToMany(() => Disponibilidad, (disponibilidad) => disponibilidad.negocio)
  disponibilidades?: Disponibilidad[];

  @OneToMany(() => Suscripcion, (suscripcion) => suscripcion.negocio)
  suscripciones?: Suscripcion[];
}
