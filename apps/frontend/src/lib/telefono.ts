import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { localeDe } from './fecha-negocio';

/**
 * Teléfonos en formato internacional E.164 (Bloque 5, punto 5.3), con
 * `libphonenumber-js` y sus metadatos `min` (los de por defecto, ~80 kB según
 * su documentación): validan longitud y prefijo por país, que es lo que hace
 * falta aquí; los `max` (~145 kB) solo agregan el tipo de línea.
 *
 * WhatsApp Cloud API recomienda mandar el número con "+" y código de país
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers),
 * que es justamente E.164: "+50688880000".
 */
export const PAIS_TELEFONO_POR_DEFECTO: CountryCode = 'CR';

/** Número en E.164 si es válido para ese país (o si ya trae "+código"); si no, `null`. */
export function normalizarTelefono(
  numero: string,
  pais: CountryCode = PAIS_TELEFONO_POR_DEFECTO,
): string | null {
  const limpio = numero.trim();
  if (limpio === '') return null;
  const parseado = parsePhoneNumberFromString(limpio, pais);
  return parseado?.isValid() ? parseado.number : null;
}

/**
 * Separa un teléfono guardado en país + número nacional para el formulario.
 * Acepta los formatos antiguos ("8888-0000", "+506 8888-0000") y, si no se
 * puede interpretar, lo deja tal cual en el campo con Costa Rica, para que la
 * persona lo corrija al editar (los datos viejos no se migran en masa).
 */
export function separarTelefono(guardado?: string | null): { pais: CountryCode; numero: string } {
  if (!guardado) return { pais: PAIS_TELEFONO_POR_DEFECTO, numero: '' };
  const parseado = parsePhoneNumberFromString(guardado, PAIS_TELEFONO_POR_DEFECTO);
  if (parseado?.country && parseado.isValid()) {
    return { pais: parseado.country, numero: parseado.nationalNumber };
  }
  return { pais: PAIS_TELEFONO_POR_DEFECTO, numero: guardado };
}

/** Países para el selector: "Costa Rica (+506)", con el nombre en el idioma de la interfaz. */
export function opcionesPaisesTelefono(
  idioma: string,
): Array<{ value: CountryCode; label: string }> {
  let nombres: Intl.DisplayNames | null = null;
  try {
    nombres = new Intl.DisplayNames([localeDe(idioma)], { type: 'region' });
  } catch {
    nombres = null;
  }
  return getCountries()
    .map((pais) => ({
      value: pais,
      label: `${nombres?.of(pais) ?? pais} (+${getCountryCallingCode(pais)})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, localeDe(idioma)));
}

export function esPaisTelefono(valor: unknown): valor is CountryCode {
  return typeof valor === 'string' && (getCountries() as string[]).includes(valor);
}
