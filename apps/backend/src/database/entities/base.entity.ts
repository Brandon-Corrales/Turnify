import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Timestamps de auditoría obligatorios en toda tabla del ER. */
export abstract class AuditableEntity {
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
