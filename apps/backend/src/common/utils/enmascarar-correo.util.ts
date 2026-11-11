/**
 * Enmascara una dirección de correo para logs de auditoría sin exponer datos de usuario.
 * Ejemplo: juan.perez@example.com -> j***@example.com
 */
export function enmascararCorreo(correo: string | null | undefined): string {
  if (!correo || typeof correo !== 'string') return '';
  const partes = correo.trim().split('@');
  if (partes.length !== 2) return '***@***';
  const [local, dominio] = partes;
  const visible = local.length <= 1 ? local : `${local[0]}***`;
  return `${visible}@${dominio}`;
}
