import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SuscripcionesService } from './suscripciones.service';
import { TenantContextService } from '../../common/tenant';
import { EstadoSuscripcion, PlanSuscripcion, RolUsuario } from '../../database/entities';

const NEGOCIO_ID = 'negocio-1';

function crearSuscripcionRepoMock() {
  return {
    findOne: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn((data) => Promise.resolve({ idSuscripcion: 'suscripcion-nueva', ...data })),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function crearNegocioRepoMock() {
  return { findOne: vi.fn(), update: vi.fn().mockResolvedValue(undefined) };
}

function crearStripeMock() {
  return { crearCheckoutSession: vi.fn(), construirEvento: vi.fn() };
}

function crearLimitesPlanMock() {
  return {
    limite: vi.fn(
      (recurso: string) =>
        ({ usuarios: 1, servicios: 3, reservas: 20, mensajesChatbot: 10 })[recurso]!,
    ),
  };
}

describe('SuscripcionesService', () => {
  let suscripcionRepo: ReturnType<typeof crearSuscripcionRepoMock>;
  let negocioRepo: ReturnType<typeof crearNegocioRepoMock>;
  let stripe: ReturnType<typeof crearStripeMock>;
  let limitesPlan: ReturnType<typeof crearLimitesPlanMock>;
  let tenantContext: TenantContextService;
  let service: SuscripcionesService;

  beforeEach(() => {
    suscripcionRepo = crearSuscripcionRepoMock();
    negocioRepo = crearNegocioRepoMock();
    stripe = crearStripeMock();
    limitesPlan = crearLimitesPlanMock();
    tenantContext = new TenantContextService();
    service = new SuscripcionesService(
      suscripcionRepo as any,
      negocioRepo as any,
      tenantContext,
      stripe as any,
      limitesPlan as any,
    );
  });

  function comoAdmin<T>(fn: () => T): T {
    return tenantContext.run(
      { idNegocio: NEGOCIO_ID, idUsuario: 'admin-1', rol: RolUsuario.ADMIN },
      fn,
    );
  }

  it('obtenerActual() devuelve la suscripción más reciente del negocio', async () => {
    suscripcionRepo.findOne.mockResolvedValue({
      idSuscripcion: 'sus-1',
      plan: PlanSuscripcion.GRATIS,
    });
    const resultado = await comoAdmin(() => service.obtenerActual());
    expect(suscripcionRepo.findOne).toHaveBeenCalledWith({
      where: { idNegocio: NEGOCIO_ID },
      order: { fechaInicio: 'DESC' },
    });
    expect(resultado.idSuscripcion).toBe('sus-1');
  });

  it('obtenerActual() lanza NotFoundException si el negocio no tiene suscripción', async () => {
    suscripcionRepo.findOne.mockResolvedValue(null);
    await expect(comoAdmin(() => service.obtenerActual())).rejects.toThrow(NotFoundException);
  });

  it('iniciarUpgrade() delega en StripeService con el idNegocio del tenant', async () => {
    stripe.crearCheckoutSession.mockResolvedValue('https://checkout.stripe.com/test');
    const resultado = await comoAdmin(() =>
      service.iniciarUpgrade('https://app/exito', 'https://app/cancelada'),
    );
    expect(stripe.crearCheckoutSession).toHaveBeenCalledWith({
      idNegocio: NEGOCIO_ID,
      successUrl: 'https://app/exito',
      cancelUrl: 'https://app/cancelada',
    });
    expect(resultado).toEqual({ url: 'https://checkout.stripe.com/test' });
  });

  describe('manejarEvento()', () => {
    it('checkout.session.completed crea la suscripción de pago y actualiza Negocio.planSuscripcion', async () => {
      suscripcionRepo.findOne.mockResolvedValue(null); // no procesado antes
      await service.manejarEvento({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            subscription: 'sub_123',
            amount_total: 500000, // ₡5000.00 en centavos
            metadata: { idNegocio: NEGOCIO_ID },
            client_reference_id: null,
          },
        },
      } as any);

      expect(suscripcionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          idNegocio: NEGOCIO_ID,
          plan: PlanSuscripcion.BASICO,
          estado: EstadoSuscripcion.ACTIVA,
          idPagoPasarela: 'sub_123',
          montoMensual: '5000.00',
        }),
      );
      expect(negocioRepo.update).toHaveBeenCalledWith(
        { idNegocio: NEGOCIO_ID },
        { planSuscripcion: PlanSuscripcion.BASICO },
      );
    });

    it('checkout.session.completed es idempotente: no duplica si ya se procesó esa sesión', async () => {
      suscripcionRepo.findOne.mockResolvedValue({ idSuscripcion: 'ya-existe' });
      await service.manejarEvento({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            subscription: 'sub_123',
            metadata: { idNegocio: NEGOCIO_ID },
          },
        },
      } as any);
      expect(suscripcionRepo.save).not.toHaveBeenCalled();
      expect(negocioRepo.update).not.toHaveBeenCalled();
    });

    it('customer.subscription.deleted vuelve el negocio a plan gratis', async () => {
      suscripcionRepo.findOne.mockResolvedValue({
        idSuscripcion: 'sus-1',
        idNegocio: NEGOCIO_ID,
      });
      await service.manejarEvento({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_123' } },
      } as any);
      expect(suscripcionRepo.update).toHaveBeenCalledWith(
        { idSuscripcion: 'sus-1' },
        expect.objectContaining({ estado: EstadoSuscripcion.CANCELADA }),
      );
      expect(negocioRepo.update).toHaveBeenCalledWith(
        { idNegocio: NEGOCIO_ID },
        { planSuscripcion: PlanSuscripcion.GRATIS },
      );
    });

    it('customer.subscription.updated con status=past_due suspende sin cancelar', async () => {
      suscripcionRepo.findOne.mockResolvedValue({
        idSuscripcion: 'sus-1',
        idNegocio: NEGOCIO_ID,
      });
      await service.manejarEvento({
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_123', status: 'past_due' } },
      } as any);
      expect(suscripcionRepo.update).toHaveBeenCalledWith(
        { idSuscripcion: 'sus-1' },
        { estado: EstadoSuscripcion.SUSPENDIDA },
      );
    });
  });

  it('obtenerLimitesPlanes() devuelve los límites reales del Plan Gratis desde LimitesPlanService (sin sesión)', () => {
    expect(service.obtenerLimitesPlanes()).toEqual({
      gratis: { usuarios: 1, servicios: 3, reservasPorMes: 20, mensajesChatbotPorDia: 10 },
    });
    expect(limitesPlan.limite).toHaveBeenCalledWith('usuarios');
    expect(limitesPlan.limite).toHaveBeenCalledWith('servicios');
    expect(limitesPlan.limite).toHaveBeenCalledWith('reservas');
    expect(limitesPlan.limite).toHaveBeenCalledWith('mensajesChatbot');
  });
});
