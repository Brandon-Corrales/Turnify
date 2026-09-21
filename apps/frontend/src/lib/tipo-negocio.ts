import type { TFunction } from 'i18next';

/** Espejo del enum TipoNegocio del backend (database/entities/enums.ts) — mismo orden y valores. */
export const TIPOS_NEGOCIO = [
  'barberia',
  'salon_belleza',
  'clinica',
  'clinica_dental',
  'spa',
  'estudio_tatuajes',
  'entrenamiento_personal',
  'estetica',
  'veterinaria_grooming',
  'otro',
] as const;

export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/** Función en vez de constante (igual que los schemas de validation.ts) para que la etiqueta cambie de idioma al vuelo. */
export function crearEtiquetaTipoNegocio(t: TFunction): Record<TipoNegocio, string> {
  return {
    barberia: t('tipoNegocio.barberia'),
    salon_belleza: t('tipoNegocio.salonBelleza'),
    clinica: t('tipoNegocio.clinica'),
    clinica_dental: t('tipoNegocio.clinicaDental'),
    spa: t('tipoNegocio.spa'),
    estudio_tatuajes: t('tipoNegocio.estudioTatuajes'),
    entrenamiento_personal: t('tipoNegocio.entrenamientoPersonal'),
    estetica: t('tipoNegocio.estetica'),
    veterinaria_grooming: t('tipoNegocio.veterinariaGrooming'),
    otro: t('tipoNegocio.otro'),
  };
}
