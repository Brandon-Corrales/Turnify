import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

const sessionsCreateMock = vi.fn();
const constructEventMock = vi.fn();

// Simula el SDK completo de Stripe — nunca se llama a la API real en un
// test unitario (igual que ResendService/WhatsappCloudApiService). Los
// vi.mock() de Vitest se izan (hoist) antes de los imports de arriba, así
// que StripeService ya recibe la versión mockeada al importarse.
vi.mock('stripe', () => {
  class StripeMock {
    checkout = { sessions: { create: sessionsCreateMock } };
    webhooks = { constructEvent: constructEventMock };
  }
  return { default: StripeMock };
});

function crearConfigMock(valores: Record<string, string | undefined>) {
  return { get: (clave: string) => valores[clave] } as unknown as ConfigService<any, true>;
}

describe('StripeService', () => {
  beforeEach(() => {
    sessionsCreateMock.mockReset();
    constructEventMock.mockReset();
  });

  it('crearCheckoutSession() lanza 503 PASARELA_PAGOS_NO_DISPONIBLE si falta configuración', async () => {
    const service = new StripeService(crearConfigMock({}));
    const promesa = service.crearCheckoutSession({
      idNegocio: 'negocio-1',
      successUrl: 'https://app/exito',
      cancelUrl: 'https://app/cancelada',
    });
    await expect(promesa).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promesa).rejects.toMatchObject({
      response: { errorCode: 'PASARELA_PAGOS_NO_DISPONIBLE' },
    });
  });

  it('crearCheckoutSession() arma la sesión en modo subscription con el idNegocio en metadata', async () => {
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
    const service = new StripeService(
      crearConfigMock({
        STRIPE_SECRET_KEY: 'sk_test_fake',
        STRIPE_PRICE_ID_PLAN_PAGO: 'price_fake',
      }),
    );

    const url = await service.crearCheckoutSession({
      idNegocio: 'negocio-1',
      successUrl: 'https://app/exito',
      cancelUrl: 'https://app/cancelada',
    });

    expect(url).toBe('https://checkout.stripe.com/test');
    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_fake', quantity: 1 }],
        metadata: { idNegocio: 'negocio-1' },
        client_reference_id: 'negocio-1',
      }),
    );
  });

  it('construirEvento() delega en stripe.webhooks.constructEvent con el secret configurado', () => {
    constructEventMock.mockReturnValue({ type: 'checkout.session.completed' });
    const service = new StripeService(
      crearConfigMock({ STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake' }),
    );

    const evento = service.construirEvento(Buffer.from('{}'), 'firma-de-prueba');

    expect(constructEventMock).toHaveBeenCalledWith(
      Buffer.from('{}'),
      'firma-de-prueba',
      'whsec_fake',
    );
    expect(evento).toEqual({ type: 'checkout.session.completed' });
  });

  it('construirEvento() lanza si falta el webhook secret', () => {
    const service = new StripeService(crearConfigMock({ STRIPE_SECRET_KEY: 'sk_test_fake' }));
    expect(() => service.construirEvento(Buffer.from('{}'), 'x')).toThrow(/no está configurado/);
  });
});
