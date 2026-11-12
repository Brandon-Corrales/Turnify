/**
 * Hosts que se consideran "esta misma máquina". Lo usan la protección de la
 * base de pruebas (test-utils/base-datos-pruebas.ts) y el aviso de ambiente
 * al arrancar (config/ambiente.ts).
 */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function esHostLocal(host: string): boolean {
  return HOSTS_LOCALES.has(host.toLowerCase());
}
