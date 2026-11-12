import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui';
import { MONEDAS_PERMITIDAS, nombreMoneda, simboloMoneda } from '@/lib/dinero';

export interface SelectorMonedaProps {
  value: string;
  onChange: (moneda: string) => void;
  hint?: string;
  disabled?: boolean;
}

/**
 * Selector de moneda del negocio (Bloque 5, punto 5.2): `<select>` nativo con
 * las monedas permitidas, cada una como "₡ — colón costarricense (CRC)" en el
 * idioma de la interfaz.
 */
export function SelectorMoneda({ value, onChange, hint, disabled }: SelectorMonedaProps) {
  const { t, i18n } = useTranslation();
  const opciones = MONEDAS_PERMITIDAS.map((codigo) => ({
    value: codigo,
    label: `${simboloMoneda(codigo, i18n.language)} — ${nombreMoneda(codigo, i18n.language)} (${codigo})`,
  }));
  return (
    <Select
      label={t('negocio.monedaCampo')}
      opciones={opciones}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={hint}
      disabled={disabled}
    />
  );
}
