import type { UsoPlan } from './suscripciones-api';

export interface ResumenUso {
  usadas: number;
  limite: number | null;
  /** 0–100, recortado; null si no hay límite. */
  porcentaje: number | null;
  alcanzado: boolean;
}

/** Lo que muestra el indicador de uso de la pantalla de Suscripción. */
export function resumirUso(uso: UsoPlan): ResumenUso {
  const { usadas, limite } = uso.reservasMes;
  if (limite === null || limite <= 0) {
    return { usadas, limite: null, porcentaje: null, alcanzado: false };
  }
  return {
    usadas,
    limite,
    porcentaje: Math.min(100, Math.round((usadas / limite) * 100)),
    alcanzado: usadas >= limite,
  };
}
