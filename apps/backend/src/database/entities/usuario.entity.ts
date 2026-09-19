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

/**
 * Índice único parcial (solo `eliminado_en IS NULL`): un usuario
 * soft-deleted libera su correo para que uno nuevo lo reuse.
 */
@Entity('usuarios')
@Index('uq_usuario_correo_activo', ['correoElectronico'], {
  unique: true,
  where: '"eliminado_en" IS NULL',
})
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

  @Column({ name: 'correo_electronico', type: 'varchar', length: 255 })
  correoElectronico!: string;

  @Column({ name: 'contrasena_hash', type: 'varchar', length: 255, select: false })
  contrasenaHash!: string;

  /** Hash bcrypt del refresh token vigente (rotación en cada uso, ver AuthService). */
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255, nullable: true, select: false })
  refreshTokenHash?: string | null;

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
