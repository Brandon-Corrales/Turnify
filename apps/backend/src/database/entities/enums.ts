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
