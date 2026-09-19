import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';
import { TipoNegocio } from './enums';

/**
 * Catálogo estático de servicios sugeridos por vertical (punto 2 del
 * brief): referencia global sembrada por seed/migración, sin id_negocio
 * (no es dato de un tenant) y sin endpoints de creación/edición — no
 * existe un rol superadmin de plataforma que la administre. Solo se lee
 * (GET) durante el onboarding tras el registro.
 */
@Entity('plantillas_servicio')
export class PlantillaServicio extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_plantilla' })
  idPlantilla!: string;

  @Index()
  @Column({ name: 'tipo_negocio', type: 'enum', enum: TipoNegocio })
  tipoNegocio!: TipoNegocio;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ name: 'duracion_minutos_sugerida', type: 'int' })
  duracionMinutosSugerida!: number;

  @Column({ name: 'orden', type: 'int', default: 0 })
  orden!: number;
}
