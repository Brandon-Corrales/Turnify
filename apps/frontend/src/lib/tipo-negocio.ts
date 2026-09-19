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

export const ETIQUETA_TIPO_NEGOCIO: Record<TipoNegocio, string> = {
  barberia: 'Barbería',
  salon_belleza: 'Salón de belleza',
  clinica: 'Clínica (consulta general/médica)',
  clinica_dental: 'Clínica dental',
  spa: 'Spa',
  estudio_tatuajes: 'Estudio de tatuajes',
  entrenamiento_personal: 'Entrenamiento personal',
  estetica: 'Estética',
  veterinaria_grooming: 'Veterinaria / grooming',
  otro: 'Otro',
};
