import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';
import { EstadoSuscripcion, PlanSuscripcion } from './enums';
import { Negocio } from './negocio.entity';

@Entity('suscripciones')
export class Suscripcion extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_suscripcion' })
  idSuscripcion!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.suscripciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio!: Negocio;

  @Column({ name: 'plan', type: 'enum', enum: PlanSuscripcion, default: PlanSuscripcion.GRATIS })
  plan!: PlanSuscripcion;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio!: Date;

  @Column({ name: 'fecha_fin', type: 'timestamptz', nullable: true })
  fechaFin?: Date | null;

  @Column({ name: 'monto_mensual', type: 'numeric', precision: 10, scale: 2, default: 0 })
  montoMensual!: string;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoSuscripcion,
    default: EstadoSuscripcion.ACTIVA,
  })
  estado!: EstadoSuscripcion;

  @Column({ name: 'id_pago_pasarela', type: 'varchar', length: 255, nullable: true })
  idPagoPasarela?: string;
}
