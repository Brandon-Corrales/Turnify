import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

/**
 * Normaliza una cadena quitando tildes y diacríticos y pasando a minúsculas
 * para comparación segura e insensible a mayúsculas o acentos.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Verifica si un texto contiene algún término bloqueado según la lista
 * provista o la variable de entorno `TERMINOS_BLOQUEADOS` (separada por comas).
 * Lista vacía por defecto.
 */
export function contieneTerminosBloqueados(
  texto: string | null | undefined,
  terminosConfig = process.env.TERMINOS_BLOQUEADOS,
): boolean {
  if (!texto || !terminosConfig) return false;

  const lista = terminosConfig
    .split(',')
    .map((t) => normalizarTexto(t.trim()))
    .filter((t) => t.length > 0);

  if (lista.length === 0) return false;

  const textoNormalizado = normalizarTexto(texto);
  return lista.some((termino) => textoNormalizado.includes(termino));
}

/**
 * Decorador de class-validator para moderación de contenido en campos de texto libre.
 * Rechaza textos que contengan términos bloqueados configurados en el entorno.
 */
export function TerminosPermitidos(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'terminosPermitidos',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: i18nValidationMessage('validacion.TERMINO_BLOQUEADO'),
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          return !contieneTerminosBloqueados(value);
        },
      },
    });
  };
}
