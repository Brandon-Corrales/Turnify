import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditableEntity } from './base.entity';

/**
 * Historial del asistente contextual (punto 16 del brief) — módulo nuevo,
 * no estaba en el ER original de la brief. Una fila por pregunta del
 * usuario (no una fila por turno de la conversación); `creadoEn` es lo
 * que usa el guard de límites del plan gratis para contar mensajes del
 * día calendario.
 *
 * `idUsuario` (nunca `idCliente`): esta tarjeta cubre el lado admin/
 * empleado del chatbot, el único que hoy tiene un mecanismo de auth real
 * (JWT vía USUARIO). El lado "cliente final" del punto 16 necesita el
 * wizard de reserva pública + su propio modelo de auth de CLIENTE —
 * ninguno de los dos existe todavía (son tarjetas de frontend
 * posteriores) — así que no se puede construir esa mitad todavía sin
 * inventar una autenticación de cliente que no pidió ninguna tarjeta.
 */
@Entity('mensajes_chatbot')
export class MensajeChatbot extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_mensaje' })
  idMensaje!: string;

  @Index()
  @Column({ name: 'id_negocio', type: 'uuid' })
  idNegocio!: string;

  @Index()
  @Column({ name: 'id_usuario', type: 'uuid' })
  idUsuario!: string;

  @Column({ name: 'pregunta', type: 'text' })
  pregunta!: string;

  @Column({ name: 'respuesta', type: 'text', nullable: true })
  respuesta?: string | null;
}
