import { SetMetadata } from '@nestjs/common';

export const LIMITE_PLAN_KEY = 'limitePlanGratis';

export type RecursoLimitado = 'usuarios' | 'servicios' | 'reservas';

/** Marca un endpoint como sujeto a los límites del Plan Gratis (punto 5.1 del brief) — leído por LimitePlanGratisGuard. */
export const LimitePlan = (recurso: RecursoLimitado) => SetMetadata(LIMITE_PLAN_KEY, recurso);
