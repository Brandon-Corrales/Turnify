export enum RolUsuario {
  ADMIN = 'admin',
  EMPLEADO = 'empleado',
}

export enum CanalPreferido {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export enum Idioma {
  ES = 'es',
  EN = 'en',
}

export enum NivelCliente {
  GRATIS = 'gratis',
  PREMIUM = 'premium',
}

export enum EstadoReserva {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  CANCELADA = 'cancelada',
  AUSENTE = 'ausente',
}

export enum OrigenReserva {
  ONLINE = 'online',
  ADMIN = 'admin',
}

export enum TipoNotificacion {
  RECORDATORIO = 'recordatorio',
  CONFIRMACION = 'confirmacion',
  CANCELACION = 'cancelacion',
}

export enum CanalNotificacion {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
}

export enum EstadoNotificacion {
  PENDIENTE = 'pendiente',
  ENVIADA = 'enviada',
  FALLIDA = 'fallida',
}

export enum PlanSuscripcion {
  GRATIS = 'gratis',
  BASICO = 'basico',
  PREMIUM = 'premium',
  EMPRESARIAL = 'empresarial',
}

export enum EstadoSuscripcion {
  ACTIVA = 'activa',
  SUSPENDIDA = 'suspendida',
  CANCELADA = 'cancelada',
}

/**
 * Verticales soportadas (punto 2 del brief) — Turnify es una plantilla
 * funcional que se amolda al rubro del negocio, no una app de un solo
 * rubro. Lista tomada de categorías reales de plataformas de reservas ya
 * establecidas (Fresha, Vagaro, SalonBoost), no inventada.
 */
export enum TipoNegocio {
  BARBERIA = 'barberia',
  SALON_BELLEZA = 'salon_belleza',
  CLINICA = 'clinica',
  CLINICA_DENTAL = 'clinica_dental',
  SPA = 'spa',
  ESTUDIO_TATUAJES = 'estudio_tatuajes',
  ENTRENAMIENTO_PERSONAL = 'entrenamiento_personal',
  ESTETICA = 'estetica',
  VETERINARIA_GROOMING = 'veterinaria_grooming',
  OTRO = 'otro',
}
