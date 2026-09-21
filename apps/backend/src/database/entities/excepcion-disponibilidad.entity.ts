import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';
import { Usuario } from './usuario.entity';

/**
 * Bloqueos/excepciones puntuales sobre la disponibilidad recurrente
 * (DISPONIBILIDAD): vacaciones, incapacidades, feriados propios del
 * usuario. Se mantiene como tabla separada porque su cardinalidad y ciclo
 * de vida son distintos (eventos puntuales por fecha, no reglas semanales
 * recurrentes) — ver decisión en PROGRESS.md.
 */
@Entity('excepciones_disponibilidad')
@Index('idx_excepcion_usuario_fecha', ['idUsuario', 'fecha'], { unique: true })
export class ExcepcionDisponibilidad extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_excepcion' })
  idExcepcion!: string;

  @Column({ name: 'id_usuario', type: 'uuid' })
  idUsuario!: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.excepcionesDisponibilidad, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;

  @Column({ name: 'fecha', type: 'date' })
  fecha!: string;

  @Column({ name: 'bloqueado', type: 'boolean', default: true })
  bloqueado!: boolean;

  @Column({ name: 'motivo', type: 'varchar', length: 255, nullable: true })
  motivo?: string;
}
