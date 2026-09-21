import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PrivilegiosClienteService } from './privilegios-cliente.service';
import { NivelCliente, PlanSuscripcion } from '../../database/entities';

const NEGOCIO_ID = 'negocio-1';
const CLIENTE_ID = 'cliente-1';

describe('PrivilegiosClienteService', () => {
  let clienteRepo: { findOne: ReturnType<typeof vi.fn> };
  let negocioRepo: { findOne: ReturnType<typeof vi.fn> };
  let i18n: { translate: ReturnType<typeof vi.fn> };
  let service: PrivilegiosClienteService;

  beforeEach(() => {
    clienteRepo = { findOne: vi.fn() };
    negocioRepo = { findOne: vi.fn() };
    i18n = { translate: vi.fn((_key: string, opts: any) => opts.defaultValue) };
    service = new PrivilegiosClienteService(clienteRepo as any, negocioRepo as any, i18n as any);
  });

  it('permite WhatsApp cuando el cliente es Premium y el negocio está en un plan de pago', async () => {
    negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.BASICO });
    await expect(
      service.verificarCanalWhatsapp(NEGOCIO_ID, undefined, NivelCliente.PREMIUM),
    ).resolves.toBeUndefined();
  });

  it('bloquea WhatsApp si el nivel efectivo (del body) es Gratis, sin llegar a consultar el negocio', async () => {
    const promesa = service.verificarCanalWhatsapp(NEGOCIO_ID, undefined, NivelCliente.GRATIS);
    await expect(promesa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promesa).rejects.toMatchObject({
      response: { errorCode: 'PRIVILEGIO_CLIENTE_NO_DISPONIBLE' },
    });
    expect(negocioRepo.findOne).not.toHaveBeenCalled();
  });

  it('en un update sin nivelCliente en el body, usa el nivel actual del cliente en BD', async () => {
    clienteRepo.findOne.mockResolvedValue({ nivelCliente: NivelCliente.PREMIUM });
    negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.PREMIUM });

    await expect(
      service.verificarCanalWhatsapp(NEGOCIO_ID, CLIENTE_ID, undefined),
    ).resolves.toBeUndefined();
    expect(clienteRepo.findOne).toHaveBeenCalledWith({ where: { idCliente: CLIENTE_ID } });
  });

  it('en una creación sin nivelCliente en el body, asume Gratis (el default) y bloquea', async () => {
    await expect(service.verificarCanalWhatsapp(NEGOCIO_ID, undefined, undefined)).rejects.toThrow(
      ForbiddenException,
    );
    expect(clienteRepo.findOne).not.toHaveBeenCalled();
  });

  it('cliente Premium en un negocio de Plan Gratis igual se bloquea (el techo lo pone el negocio)', async () => {
    negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.GRATIS });
    await expect(
      service.verificarCanalWhatsapp(NEGOCIO_ID, undefined, NivelCliente.PREMIUM),
    ).rejects.toMatchObject({
      response: { errorCode: 'PRIVILEGIO_CLIENTE_NO_DISPONIBLE' },
    });
  });
});
