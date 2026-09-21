import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant';
import { MensajeChatbot, RolUsuario } from '../../database/entities';
import { NegociosService } from '../negocios/negocios.service';
import { ServiciosService } from '../servicios/servicios.service';
import { ReservasService } from '../reservas/reservas.service';
import { BASE_CONOCIMIENTO_TURNIFY } from './base-conocimiento';
import { LLM_CLIENT, LlmClient, MensajeLlm } from './providers/llm-client.interface';

export interface PreguntaChatbot {
  idNegocio: string;
  idUsuario: string;
  rol: RolUsuario;
  pantallaActual?: string;
  pregunta: string;
  /** Turnos previos de ESTA MISMA conexión de WebSocket — no persiste entre reconexiones. */
  historialPrevio: MensajeLlm[];
}

const MENSAJE_DEGRADADO =
  'El asistente no está disponible en este momento. Intenta de nuevo más tarde.';

/**
 * Orquesta el asistente contextual (punto 16 del brief).
 *
 * - **Multi-tenant**: TODO el contexto de negocio se arma dentro de
 *   `tenantContext.run(...)` con el idNegocio del socket autenticado —
 *   el MISMO mecanismo que usa cualquier endpoint HTTP (vía el
 *   interceptor), no uno aparte para el chatbot. Nada que venga del
 *   mensaje del usuario puede cambiar de qué negocio se leen datos.
 * - **Reutiliza services existentes** (Negocios/Servicios/Reservas) en
 *   vez de consultar la base de datos directo desde este módulo.
 * - **Privacidad**: el contexto que se arma nunca incluye datos de
 *   CLIENTE ni credenciales — el tier gratuito del LLM puede usar
 *   prompts/respuestas para mejorar sus productos.
 * - **Manejo de fallas**: si el LLM falla (o no está configurado), se
 *   degrada a un mensaje amable en vez de romper la conexión.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @InjectRepository(MensajeChatbot) private readonly mensajeRepo: Repository<MensajeChatbot>,
    private readonly negociosService: NegociosService,
    private readonly serviciosService: ServiciosService,
    private readonly reservasService: ReservasService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async *responder(datos: PreguntaChatbot): AsyncGenerator<string> {
    let respuestaCompleta = '';
    try {
      const systemPrompt = await this.tenantContext.run(
        { idNegocio: datos.idNegocio, idUsuario: datos.idUsuario, rol: datos.rol },
        () => this.construirContexto(datos.rol, datos.pantallaActual),
      );

      const historial: MensajeLlm[] = [
        ...datos.historialPrevio,
        { rol: 'user', texto: datos.pregunta },
      ];

      for await (const fragmento of this.llm.generarRespuestaStream(systemPrompt, historial)) {
        respuestaCompleta += fragmento;
        yield fragmento;
      }
    } catch (error) {
      this.logger.warn(`Chatbot degradado por error del LLM: ${(error as Error).message}`);
      respuestaCompleta = MENSAJE_DEGRADADO;
      yield MENSAJE_DEGRADADO;
    } finally {
      await this.mensajeRepo.save(
        this.mensajeRepo.create({
          idNegocio: datos.idNegocio,
          idUsuario: datos.idUsuario,
          pregunta: datos.pregunta,
          respuesta: respuestaCompleta,
        }),
      );
    }
  }

  private async construirContexto(rol: RolUsuario, pantallaActual?: string): Promise<string> {
    const negocio = await this.negociosService.obtenerMiNegocio();
    const servicios = await this.serviciosService.listar({ page: 1, limit: 1 } as any);

    const inicioHoy = new Date();
    inicioHoy.setUTCHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setUTCHours(23, 59, 59, 999);

    // Solo para admin/empleado (nunca hay "cliente final" autenticado
    // todavía — ver el comentario largo en la entidad MensajeChatbot).
    const reservasHoy = await this.reservasService.listar({
      page: 1,
      limit: 1,
      desde: inicioHoy.toISOString(),
      hasta: finHoy.toISOString(),
    } as any);

    return [
      BASE_CONOCIMIENTO_TURNIFY,
      '',
      '## Contexto de esta conversación (datos reales, no inventes otros)',
      `- Rol de quien pregunta: ${rol}`,
      `- Pantalla actual del frontend: ${pantallaActual ?? 'no especificada'}`,
      `- Nombre del negocio: ${negocio.nombre}`,
      `- Tipo de negocio: ${negocio.tipoNegocio}`,
      `- Plan de suscripción actual: ${negocio.planSuscripcion}`,
      `- Servicios activos: ${servicios.total}`,
      `- Reservas de hoy: ${reservasHoy.total}`,
    ].join('\n');
  }
}
