import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

/**
 * Lista de contraseñas excesivamente comunes o predecibles que no deben
 * ser permitidas según las recomendaciones NIST SP 800-63B.
 */
export const CONTRASENAS_COMUNES = new Set([
  '123456789012',
  'password1234',
  'contrasena12',
  'qwertyuiop12',
  'administrador',
  'turnify12345',
  'admin1234567',
  'welcome12345',
  'turnify202612',
]);

/**
 * Validador puro de contraseña segura:
 * - 12 a 64 caracteres
 * - Máximo 72 bytes en UTF-8 (límite arquitectónico de bcrypt)
 * - Al menos una letra y un número
 * - No estar en la lista de contraseñas comunes
 */
export function esContrasenaSegura(valor: unknown): boolean {
  if (typeof valor !== 'string') return false;
  if (valor.length < 12 || valor.length > 64) return false;
  if (Buffer.byteLength(valor, 'utf8') > 72) return false;
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(valor)) return false;
  if (CONTRASENAS_COMUNES.has(valor.toLowerCase())) return false;
  return true;
}

export function EsContrasenaValida(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'esContrasenaValida',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: i18nValidationMessage('validacion.CONTRASENA_INVALIDA'),
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return esContrasenaSegura(value);
        },
      },
    });
  };
}
