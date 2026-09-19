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
import { RolUsuario } from './enums';
import { Negocio } from './negocio.entity';
import { Reserva } from './reserva.entity';
import { Disponibilidad } from './disponibilidad.entity';
import { ExcepcionDisponibilidad } from './excepcion-disponibilidad.entity';

@Entity('usuarios')
export class Usuario extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_usuario' })
  idUsuario!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.usuarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  @Column({ name: 'nombre_completo', type: 'varchar', length: 150 })
  nombreCompleto!: string;

  @Column({ name: 'correo_electronico', type: 'varchar', length: 255, unique: true })
  correoElectronico!: string;

  @Column({ name: 'contrasena_hash', type: 'varchar', length: 255, select: false })
  contrasenaHash!: string;

  @Column({ name: 'rol', type: 'enum', enum: RolUsuario, default: RolUsuario.EMPLEADO })
  rol!: RolUsuario;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono?: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;

  @DeleteDateColumn({ name: 'eliminado_en', type: 'timestamptz', nullable: true })
  eliminadoEn?: Date | null;

  @OneToMany(() => Reserva, (reserva) => reserva.usuario)
  reservas?: Reserva[];

  @OneToMany(() => Disponibilidad, (disponibilidad) => disponibilidad.usuario)
  disponibilidades?: Disponibilidad[];

  @OneToMany(() => ExcepcionDisponibilidad, (excepcion) => excepcion.usuario)
  excepcionesDisponibilidad?: ExcepcionDisponibilidad[];
}
