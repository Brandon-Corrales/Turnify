import { registerDecorator, ValidationOptions } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { esZonaHorariaValida } from '../utils/zona-horaria-negocio';

/** Nombre de zona horaria IANA que reconoce `Intl` (Bloque 5, punto 5.1). */
export function EsZonaHoraria(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'esZonaHoraria',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: i18nValidationMessage('validacion.ZONA_HORARIA_INVALIDA'),
        ...validationOptions,
      },
      validator: { validate: (valor: unknown) => esZonaHorariaValida(valor) },
    });
  };
}
