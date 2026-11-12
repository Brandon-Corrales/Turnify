import { cn } from '@/lib/cn';

export interface LogoTurnifyProps {
  /** Lado en píxeles CSS; acompaña al texto "Turnify" con un tamaño proporcionado. */
  tamano?: 16 | 28 | 32 | 36;
  className?: string;
}

/**
 * Logo oficial de Turnify junto al nombre. Es decorativo (el texto "Turnify"
 * ya va al lado): alt vacío y aria-hidden, así el lector de pantalla no lo
 * anuncia dos veces. Usa el PNG de 192 px (≈3 KB, el mismo del manifest),
 * nítido hasta 3× en estos tamaños.
 */
export function LogoTurnify({ tamano = 28, className }: LogoTurnifyProps) {
  return (
    <img
      src="/favicon-192.png"
      alt=""
      aria-hidden="true"
      width={tamano}
      height={tamano}
      decoding="async"
      className={cn('shrink-0', className)}
      style={{ width: tamano, height: tamano }}
    />
  );
}
