import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CrearClienteDto } from '../../modules/clientes/dto/crear-cliente.dto';
import { ActualizarClienteDto } from '../../modules/clientes/dto/actualizar-cliente.dto';
import { CrearReservaPublicaDto } from '../../modules/reserva-publica/dto/crear-reserva-publica.dto';
import { normalizarTelefono } from './telefono.validator';

const cliente = (telefono?: unknown) => ({
  nombreCompleto: 'Prueba Globalizacion',
  correoElectronico: 'cliente@example.com',
  telefono,
});

async function procesar<T extends object>(clase: new () => T, datos: object) {
  const dto = plainToInstance(clase, datos);
  const errores = await validate(dto);
  return { dto, errores };
}

describe('teléfono E.164 en el backend (Bloque 5, punto 5.3)', () => {
  it('normalizarTelefono: Costa Rica por defecto y cualquier país con "+"', () => {
    expect(normalizarTelefono('8888-0000')).toBe('+50688880000');
    expect(normalizarTelefono('+506 8888 0000')).toBe('+50688880000');
    expect(normalizarTelefono('+1 (201) 555-0123')).toBe('+12015550123');
    expect(normalizarTelefono('123')).toBeNull();
  });

  it.each([
    ['8888-0000', '+50688880000'], // como lo manda el frontend anterior
    ['+12015550123', '+12015550123'], // como lo manda el frontend nuevo
  ])('crear cliente con %s guarda %s', async (entrada, esperado) => {
    const { dto, errores } = await procesar(CrearClienteDto, cliente(entrada));
    expect(errores).toEqual([]);
    expect(dto.telefono).toBe(esperado);
  });

  it('editar cliente normaliza igual', async () => {
    const { dto, errores } = await procesar(ActualizarClienteDto, { telefono: '8888 1111' });
    expect(errores).toEqual([]);
    expect(dto.telefono).toBe('+50688881111');
  });

  it('un número inválido se rechaza con el mensaje traducible', async () => {
    const { errores } = await procesar(CrearClienteDto, cliente('12345'));
    expect(errores[0].property).toBe('telefono');
    expect(Object.values(errores[0].constraints ?? {})[0]).toContain(
      'validacion.TELEFONO_INVALIDO',
    );
  });

  it('vacío o ausente sigue siendo opcional', async () => {
    expect((await procesar(CrearClienteDto, cliente(''))).errores).toEqual([]);
    expect((await procesar(CrearClienteDto, cliente(undefined))).errores).toEqual([]);
  });

  it('la reserva pública normaliza el teléfono del cliente anidado', async () => {
    const { dto, errores } = await procesar(CrearReservaPublicaDto, {
      idServicio: '6f9619ff-8b86-4d11-b42d-00c04fc964ff',
      fechaHoraInicio: '2027-03-01T16:00:00.000Z',
      cliente: cliente('8888-2222'),
    });
    expect(errores).toEqual([]);
    expect(dto.cliente.telefono).toBe('+50688882222');
  });
});
