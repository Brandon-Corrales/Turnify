import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';
import { Usuario } from './usuario.entity';
import { Negocio } from './negocio.entity';

@Entity('disponibilidades')
@Index('idx_disponibilidad_usuario_dia', ['idUsuario', 'diaSemana'])
export class Disponibilidad extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_disponibilidad' })
  idDisponibilidad!: string;

  @Index()
  @Column({ name: 'id_usuario', type: 'uuid' })
  idUsuario!: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.disponibilidades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.disponibilidades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  /** 0 = domingo … 6 = sábado */
  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana!: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;
}
