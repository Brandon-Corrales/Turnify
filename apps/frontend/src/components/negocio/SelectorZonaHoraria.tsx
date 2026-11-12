import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui';
import { etiquetaZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/fecha-negocio';

/** Zonas IANA que trae el navegador (más de 400). Sin librería: `Intl` ya las tiene. */
function zonasDisponibles(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (clave: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [ZONA_HORARIA_POR_DEFECTO];
}

export interface SelectorZonaHorariaProps {
  value: string;
  onChange: (zona: string) => void;
  hint?: string;
  disabled?: boolean;
}

/**
 * Selector de zona horaria del negocio (Bloque 5, punto 5.1). Un `<select>`
 * nativo (accesible con teclado y lector de pantalla; escribir la primera
 * letra salta a esa ciudad) con cada zona como "Ciudad — nombre traducido
 * (UTC±hh:mm)", ordenadas por ciudad en el idioma de la interfaz.
 */
export function SelectorZonaHoraria({ value, onChange, hint, disabled }: SelectorZonaHorariaProps) {
  const { t, i18n } = useTranslation();
  const opciones = useMemo(() => {
    const zonas = new Set(zonasDisponibles());
    zonas.add(value); // por si la guardada no está en la lista del navegador
    return [...zonas]
      .map((zona) => ({ value: zona, label: etiquetaZona(zona, i18n.language) }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
  }, [i18n.language, value]);

  return (
    <Select
      label={t('negocio.zonaHorariaCampo')}
      opciones={opciones}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={hint}
      disabled={disabled}
    />
  );
}
