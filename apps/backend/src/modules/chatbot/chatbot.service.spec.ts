import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatbotService } from './chatbot.service';
import { RolUsuario } from '../../database/entities';
import { TenantContextService } from '../../common/tenant';

const NEGOCIO_ID = 'negocio-1';
const USUARIO_ID = 'usuario-1';

async function* streamDe(fragmentos: string[]) {
  for (const f of fragmentos) yield f;
}

function streamQueFalla(mensaje: string): AsyncGenerator<string> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: () => Promise.reject(new Error(mensaje)),
    return: () => Promise.resolve({ done: true, value: undefined }),
    throw: () => Promise.reject(new Error(mensaje)),
  } as AsyncGenerator<string>;
}

function crearServicio() {
  const llm = { generarRespuestaStream: vi.fn() };
  const mensajeRepo = {
    create: vi.fn((datos) => datos),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const negociosService = {
    obtenerMiNegocio: vi.fn().mockResolvedValue({
      nombre: 'Barbería Nico',
      tipoNegocio: 'barberia',
      planSuscripcion: 'gratis',
    }),
  };
  const serviciosService = { listar: vi.fn().mockResolvedValue({ total: 3 }) };
  const reservasService = { listar: vi.fn().mockResolvedValue({ total: 5 }) };
  const tenantContext = new TenantContextService();

  const service = new ChatbotService(
    llm as any,
    mensajeRepo as any,
    negociosService as any,
    serviciosService as any,
    reservasService as any,
    tenantContext,
  );

  return { service, llm, mensajeRepo, negociosService, serviciosService, reservasService };
}

describe('ChatbotService', () => {
  let ctx: ReturnType<typeof crearServicio>;

  beforeEach(() => {
    ctx = crearServicio();
  });

  it('transmite los fragmentos del LLM y persiste la respuesta completa al terminar', async () => {
    ctx.llm.generarRespuestaStream.mockReturnValue(streamDe(['Hola, ', 'soy el asistente.']));

    const fragmentos: string[] = [];
    for await (const f of ctx.service.responder({
      idNegocio: NEGOCIO_ID,
      idUsuario: USUARIO_ID,
      rol: RolUsuario.ADMIN,
      pregunta: '¿Cómo agrego un servicio?',
      historialPrevio: [],
    })) {
      fragmentos.push(f);
    }

    expect(fragmentos).toEqual(['Hola, ', 'soy el asistente.']);
    expect(ctx.mensajeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idNegocio: NEGOCIO_ID,
        idUsuario: USUARIO_ID,
        pregunta: '¿Cómo agrego un servicio?',
        respuesta: 'Hola, soy el asistente.',
      }),
    );
  });

  it('se degrada a un mensaje amable si el LLM falla, y aun así guarda el registro', async () => {
    ctx.llm.generarRespuestaStream.mockReturnValue(streamQueFalla('LLM_API_KEY no configurada'));

    const fragmentos: string[] = [];
    for await (const f of ctx.service.responder({
      idNegocio: NEGOCIO_ID,
      idUsuario: USUARIO_ID,
      rol: RolUsuario.ADMIN,
      pregunta: 'hola',
      historialPrevio: [],
    })) {
      fragmentos.push(f);
    }

    expect(fragmentos).toEqual([
      'El asistente no está disponible en este momento. Intenta de nuevo más tarde.',
    ]);
    expect(ctx.mensajeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ respuesta: fragmentos[0] }),
    );
  });

  it('arma el contexto solo con datos genéricos del negocio propio, nunca datos de cliente', async () => {
    ctx.llm.generarRespuestaStream.mockReturnValue(streamDe(['ok']));

    for await (const fragmento of ctx.service.responder({
      idNegocio: NEGOCIO_ID,
      idUsuario: USUARIO_ID,
      rol: RolUsuario.EMPLEADO,
      pantallaActual: 'calendario',
      pregunta: 'hola',
      historialPrevio: [],
    })) {
      void fragmento; // consumir el stream
    }

    expect(ctx.negociosService.obtenerMiNegocio).toHaveBeenCalled();
    expect(ctx.serviciosService.listar).toHaveBeenCalled();
    expect(ctx.reservasService.listar).toHaveBeenCalled();

    const systemPrompt = ctx.llm.generarRespuestaStream.mock.calls[0][0] as string;
    expect(systemPrompt).toContain('Barbería Nico');
    expect(systemPrompt).toContain('Servicios activos: 3');
    expect(systemPrompt).toContain('Reservas de hoy: 5');
    expect(systemPrompt).toContain('empleado');
    expect(systemPrompt).toContain('calendario');
  });

  it('corre construirContexto dentro del TenantContext del negocio autenticado', async () => {
    ctx.llm.generarRespuestaStream.mockImplementation(async function* () {
      yield 'ok';
    });

    // NegociosService (mock) usa tenantContext internamente en la app real;
    // aquí solo verificamos que el TenantContext esté activo mientras se
    // construye el prompt, leyendo hasContext() desde dentro del mock.
    const tenantContext = (ctx.service as any).tenantContext as TenantContextService;
    ctx.negociosService.obtenerMiNegocio.mockImplementation(async () => {
      expect(tenantContext.hasContext()).toBe(true);
      expect(tenantContext.idNegocio).toBe(NEGOCIO_ID);
      return { nombre: 'X', tipoNegocio: 'y', planSuscripcion: 'gratis' };
    });

    for await (const fragmento of ctx.service.responder({
      idNegocio: NEGOCIO_ID,
      idUsuario: USUARIO_ID,
      rol: RolUsuario.ADMIN,
      pregunta: 'hola',
      historialPrevio: [],
    })) {
      void fragmento; // consumir el stream
    }

    expect(tenantContext.hasContext()).toBe(false);
  });
});
