import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { i18nValidationMessage } from 'nestjs-i18n';

/**
 * Teléfonos en E.164 (Bloque 5, punto 5.3), con `libphonenumber-js` (la misma
 * versión que ya traía class-validator). WhatsApp Cloud API recomienda el "+"
 * y el código de país, que es E.164: "+50688880000".
 *
 * País por defecto Costa Rica (+506): un número sin prefijo ("8888-0000") se
 * interpreta como costarricense. Así sigue funcionando el frontend anterior
 * durante el despliegue, que manda el número sin país.
 */
export const PAIS_TELEFONO_POR_DEFECTO: CountryCode = 'CR';

export function normalizarTelefono(valor: string): string | null {
  const parseado = parsePhoneNumberFromString(valor.trim(), PAIS_TELEFONO_POR_DEFECTO);
  return parseado?.isValid() ? parseado.number : null;
}

/**
 * Normaliza al crear o editar: "8888-0000" o "+506 8888 0000" →
 * "+50688880000". Cadena vacía → sin teléfono. Si no se puede interpretar,
 * deja el valor tal cual para que `@EsTelefono()` lo rechace con su mensaje.
 * Los teléfonos ya guardados no se migran: solo se normalizan al editarlos.
 */
export function NormalizarTelefono(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    if (value.trim() === '') return undefined;
    return normalizarTelefono(value) ?? value;
  });
}

export function EsTelefono(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'esTelefono',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: i18nValidationMessage('validacion.TELEFONO_INVALIDO'),
        ...validationOptions,
      },
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && normalizarTelefono(valor) !== null,
      },
    });
  };
}
