import { useId, useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input, Select, type VarianteCampo } from '@/components/ui';
import { opcionesPaisesTelefono } from '@/lib/telefono';

export interface CampoTelefonoProps {
  registroPais: UseFormRegisterReturn;
  registroNumero: UseFormRegisterReturn;
  error?: string;
  variante?: VarianteCampo;
  hint?: string;
}

/**
 * Teléfono internacional (Bloque 5, punto 5.3): país con su prefijo
 * ("Costa Rica (+506)", por defecto) + número nacional. Al enviar se guarda
 * en E.164 ("+50688880000"). Dos campos nativos con su propia etiqueta, en un
 * `fieldset` con leyenda, para que el lector de pantalla los anuncie juntos;
 * el error se asocia al número.
 */
export function CampoTelefono({
  registroPais,
  registroNumero,
  error,
  variante,
  hint,
}: CampoTelefonoProps) {
  const { t, i18n } = useTranslation();
  const idLeyenda = useId();
  const opciones = useMemo(() => opcionesPaisesTelefono(i18n.language), [i18n.language]);
  return (
    <fieldset aria-labelledby={idLeyenda} className="flex flex-col gap-1.5">
      <legend id={idLeyenda} className="sr-only">
        {t('clientes.telefono')}
      </legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Select
          label={t('telefono.pais')}
          opciones={opciones}
          variante={variante}
          {...registroPais}
        />
        <Input
          label={t('clientes.telefono')}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={25}
          variante={variante}
          hint={hint}
          error={error}
          {...registroNumero}
        />
      </div>
    </fieldset>
  );
}
