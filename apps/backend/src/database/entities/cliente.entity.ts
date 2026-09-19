import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AuditableEntity } from './base.entity';
import { CanalPreferido, Idioma, NivelCliente } from './enums';
import { Negocio } from './negocio.entity';
import { Reserva } from './reserva.entity';
import { Notificacion } from './notificacion.entity';

@Entity('clientes')
@Unique('uq_cliente_negocio_correo', ['idNegocio', 'correoElectronico'])
export class Cliente extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_cliente' })
  idCliente!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.clientes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  @Column({ name: 'nombre_completo', type: 'varchar', length: 150 })
  nombreCompleto!: string;

  @Column({ name: 'correo_electronico', type: 'varchar', length: 255 })
  correoElectronico!: string;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono?: string;

  @Column({ name: 'notas', type: 'text', nullable: true })
  notas?: string;

  @Column({
    name: 'canal_preferido',
    type: 'enum',
    enum: CanalPreferido,
    default: CanalPreferido.EMAIL,
  })
  canalPreferido!: CanalPreferido;

  @Column({ name: 'idioma_preferido', type: 'enum', enum: Idioma, default: Idioma.ES })
  idiomaPreferido!: Idioma;

  @Column({
    name: 'nivel_cliente',
    type: 'enum',
    enum: NivelCliente,
    default: NivelCliente.GRATIS,
  })
  nivelCliente!: NivelCliente;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;

  @DeleteDateColumn({ name: 'eliminado_en', type: 'timestamptz', nullable: true })
  eliminadoEn?: Date | null;

  @OneToMany(() => Reserva, (reserva) => reserva.cliente)
  reservas?: Reserva[];

  @OneToMany(() => Notificacion, (notificacion) => notificacion.cliente)
  notificaciones?: Notificacion[];
}
