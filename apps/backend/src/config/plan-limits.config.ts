/**
 * Límites del Plan Gratis (negocio/admin). El Plan de Pago no tiene techo:
 * cualquier campo en `PAID_PLAN_LIMITS` en `null` significa "sin límite".
 *
 * Estos valores son la única fuente de verdad para los guards de freemium
 * del punto 4.1 del brief (aún no implementados — ver PROGRESS.md). Viven
 * aquí, fuera del código de negocio, para poder ajustarlos sin tocar guards
 * ni servicios.
 */
export const FREE_PLAN_LIMITS = {
  maxUsuarios: 1,
  maxServiciosActivos: 3,
  maxReservasPorMes: 20,
  canalesNotificacionPermitidos: ['email'] as const,
  reportesConExportacion: false,
  chatbotMensajesPorDia: 10,
  marcaAguaVisible: true,
  personalizacionMarca: false,
};

export const PAID_PLAN_LIMITS = {
  maxUsuarios: null,
  maxServiciosActivos: null,
  maxReservasPorMes: null,
  canalesNotificacionPermitidos: ['email', 'whatsapp'] as const,
  reportesConExportacion: true,
  chatbotMensajesPorDia: null,
  marcaAguaVisible: false,
  personalizacionMarca: true,
};

export type PlanLimits = typeof FREE_PLAN_LIMITS;

/**
 * Privilegios por nivel_cliente (fidelidad), independientes del plan del
 * negocio. El techo real de canales sigue siendo el del negocio — ver
 * regla de dependencia en el brief (4.2): un cliente premium nunca
 * desbloquea un canal que el plan del negocio tiene bloqueado.
 */
export const CLIENT_TIER_PRIVILEGES = {
  gratis: {
    prioridadListaEspera: false,
    canalRecordatorioExtra: false,
  },
  premium: {
    prioridadListaEspera: true,
    canalRecordatorioExtra: true,
  },
};
