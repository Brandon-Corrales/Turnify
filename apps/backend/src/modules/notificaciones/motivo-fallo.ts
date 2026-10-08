/**
 * Motivo de fallo de una notificación, como CATEGORÍA (no texto libre).
 *
 * El texto que devuelve un proveedor puede traer datos de terceros (Resend
 * incluye el correo de la persona dueña de la cuenta del equipo; Meta, IDs
 * y teléfonos). Ese texto crudo solo va al log del servidor. A la base de
 * datos y a la API solo llega uno de estos códigos, que el frontend traduce:
 * nada que pueda filtrarse, sea cual sea el texto del proveedor.
 */
export enum MotivoFallo {
  /** El entorno de prueba del proveedor no permite ese destinatario. */
  DESTINATARIO_NO_HABILITADO = 'DESTINATARIO_NO_HABILITADO',
  /** Faltan credenciales del proveedor en el `.env` del servidor. */
  CREDENCIALES_FALTANTES = 'CREDENCIALES_FALTANTES',
  /** El canal no tiene proveedor implementado (ej. SMS). */
  CANAL_SIN_PROVEEDOR = 'CANAL_SIN_PROVEEDOR',
  /** Cualquier otro rechazo del proveedor (incluye el evento `email.failed`). */
  RECHAZADO_POR_PROVEEDOR = 'RECHAZADO_POR_PROVEEDOR',
  /** Webhook `email.bounced` con `bounce.type` "Permanent": la dirección no recibe correo. */
  REBOTE_PERMANENTE = 'REBOTE_PERMANENTE',
  /** Webhook `email.bounced` de cualquier otro tipo (ej. "Temporary", buzón lleno). */
  REBOTE_TEMPORAL = 'REBOTE_TEMPORAL',
  /** Webhook `email.delivery_delayed`: aviso, no fallo; el proveedor sigue intentando. */
  ENTREGA_DEMORADA = 'ENTREGA_DEMORADA',
  /** Webhook `email.complained`: el destinatario lo marcó como spam. */
  MARCADO_COMO_SPAM = 'MARCADO_COMO_SPAM',
}

const VALORES = new Set<string>(Object.values(MotivoFallo));

/**
 * Clasifica el texto crudo de un rechazo del proveedor. Resend sin dominio
 * verificado: "You can only send testing emails to your own email address
 * …". WhatsApp Cloud API, número fuera de la lista de prueba: error
 * 131030 "Recipient phone number not in allowed list".
 */
export function clasificarRechazoProveedor(textoCrudo: string): MotivoFallo {
  const t = textoCrudo.toLowerCase();
  if (
    t.includes('testing emails') ||
    t.includes('verify a domain') ||
    t.includes('131030') ||
    t.includes('not in allowed list')
  ) {
    return MotivoFallo.DESTINATARIO_NO_HABILITADO;
  }
  return MotivoFallo.RECHAZADO_POR_PROVEEDOR;
}

/**
 * Lo único que la API deja salir: un código conocido o `null`. Red de
 * seguridad para cualquier valor viejo o inesperado en la columna.
 */
export function motivoPublico(valor: string | null | undefined): MotivoFallo | null {
  if (!valor) return null;
  return VALORES.has(valor) ? (valor as MotivoFallo) : MotivoFallo.RECHAZADO_POR_PROVEEDOR;
}
