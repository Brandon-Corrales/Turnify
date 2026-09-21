import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditableEntity } from './base.entity';
import { Negocio } from './negocio.entity';
import { Reserva } from './reserva.entity';

@Entity('servicios')
export class Servicio extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_servicio' })
  idServicio!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.servicios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion?: string;

  @Column({ name: 'duracion_minutos', type: 'int' })
  duracionMinutos!: number;

  @Column({ name: 'precio', type: 'numeric', precision: 10, scale: 2 })
  precio!: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'color_calendario', type: 'varchar', length: 20, nullable: true })
  colorCalendario?: string;

  @DeleteDateColumn({ name: 'eliminado_en', type: 'timestamptz', nullable: true })
  eliminadoEn?: Date | null;

  @OneToMany(() => Reserva, (reserva) => reserva.servicio)
  reservas?: Reserva[];
}
