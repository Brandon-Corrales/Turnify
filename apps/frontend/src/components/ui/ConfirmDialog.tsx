import { Modal } from './Modal';
import { Boton } from './Button';

export interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
  /** Para acciones no destructivas (ej. "guardar cambios sin terminar") se puede usar variante "primario". */
  variante?: 'destructivo' | 'primario';
}

/**
 * Único modal de confirmación para TODA acción destructiva/irreversible
 * del sistema (cancelar reserva, eliminar servicio, desactivar usuario) —
 * punto 7 del brief: mismo texto de botones y mismo estilo en todos los
 * módulos, nunca redactado de nuevo por pantalla.
 */
export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  onConfirmar,
  onCancelar,
  cargando = false,
  variante = 'destructivo',
}: ConfirmDialogProps) {
  return (
    <Modal abierto={abierto} onCerrar={onCancelar} titulo={titulo}>
      {descripcion && <p className="text-sm text-slate-600 dark:text-slate-400">{descripcion}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Boton variante="secundario" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Boton>
        <Boton variante={variante} onClick={onConfirmar} cargando={cargando}>
          Confirmar
        </Boton>
      </div>
    </Modal>
  );
}
