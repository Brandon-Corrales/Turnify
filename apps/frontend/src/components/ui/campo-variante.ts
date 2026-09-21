/**
 * Convención de color en el foco de los formularios (punto 8 del brief,
 * obligatoria en todo el sistema): crear en verde, editar en azul. Un solo
 * lugar para que Input y Select compartan exactamente las mismas clases —
 * nunca un color puesto a mano en un formulario específico.
 */
export type VarianteCampo = 'crear' | 'editar' | 'neutro';

export const CLASES_FOCO_VARIANTE: Record<VarianteCampo, string> = {
  crear: 'focus:border-secondary-500 focus:ring-secondary-500',
  editar: 'focus:border-info focus:ring-info',
  neutro: 'focus:border-primary-500 focus:ring-primary-500',
};
