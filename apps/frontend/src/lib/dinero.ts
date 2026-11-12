import { localeDe } from './fecha-negocio';

/** Monedas permitidas por negocio (Bloque 5, punto 5.2). Misma lista que `MONEDAS_PERMITIDAS` del backend. */
export const MONEDAS_PERMITIDAS = ['CRC', 'USD'] as const;
export type Moneda = (typeof MONEDAS_PERMITIDAS)[number];
export const MONEDA_POR_DEFECTO: Moneda = 'CRC';

export function monedaOPorDefecto(moneda: unknown): Moneda {
  return (MONEDAS_PERMITIDAS as readonly unknown[]).includes(moneda)
    ? (moneda as Moneda)
    : MONEDA_POR_DEFECTO;
}

/**
 * Único formateador de dinero del frontend (Bloque 5, punto 5.2).
 *
 * - Decimales: los que indica `Intl` para la moneda (2 para CRC y USD), pero
 *   sin ",00" cuando el monto es entero (decisión del grupo, opción A):
 *   "₡15 000", "₡15 000,50", "$15", "$15.50". Antes CRC se redondeaba
 *   siempre a entero, así que ₡15 000,50 se veía como ₡15 001.
 * - Símbolo corto (₡, $) en los dos idiomas: con el símbolo por defecto,
 *   en inglés salía "CRC 15,000" y en español "USD 15 000".
 * - Solo formatea: nunca redondea ni modifica el monto guardado.
 */
export function formatearDinero(monto: number | string, moneda: string, idioma: string): string {
  const numero = typeof monto === 'string' ? Number(monto) : monto;
  if (!Number.isFinite(numero)) return String(monto);
  const codigo = monedaOPorDefecto(moneda);
  const base = new Intl.NumberFormat(localeDe(idioma), {
    style: 'currency',
    currency: codigo,
    currencyDisplay: 'narrowSymbol',
  });
  if (!Number.isInteger(numero)) return base.format(numero);
  return new Intl.NumberFormat(localeDe(idioma), {
    style: 'currency',
    currency: codigo,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
}

/** Símbolo de la moneda en el idioma de la interfaz ("₡", "$"), para etiquetas como "Precio (₡)". */
export function simboloMoneda(moneda: string, idioma: string): string {
  return (
    new Intl.NumberFormat(localeDe(idioma), {
      style: 'currency',
      currency: monedaOPorDefecto(moneda),
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? moneda
  );
}

/** Nombre traducido de la moneda ("colón costarricense", "US Dollar"), para el selector. */
export function nombreMoneda(moneda: string, idioma: string): string {
  try {
    return new Intl.DisplayNames([localeDe(idioma)], { type: 'currency' }).of(moneda) ?? moneda;
  } catch {
    return moneda;
  }
}
