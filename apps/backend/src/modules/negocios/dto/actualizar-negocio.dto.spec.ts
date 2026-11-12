import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ActualizarNegocioDto } from './actualizar-negocio.dto';

async function errores(datos: object) {
  const fallos = await validate(plainToInstance(ActualizarNegocioDto, datos));
  return fallos.map((f) => ({ campo: f.property, claves: Object.values(f.constraints ?? {}) }));
}

describe('ActualizarNegocioDto — zona horaria y moneda (Bloque 5)', () => {
  it.each(['CRC', 'USD'])('acepta la moneda %s', async (moneda) => {
    expect(await errores({ moneda })).toEqual([]);
  });

  it.each(['EUR', 'crc', 'colones', ''])(
    'rechaza la moneda %s con el mensaje traducible',
    async (moneda) => {
      const [fallo] = await errores({ moneda });
      expect(fallo.campo).toBe('moneda');
      expect(fallo.claves[0]).toContain('validacion.MONEDA_INVALIDA');
    },
  );

  it('acepta una zona IANA válida y rechaza una inexistente', async () => {
    expect(await errores({ zonaHoraria: 'America/New_York' })).toEqual([]);
    const [fallo] = await errores({ zonaHoraria: 'America/Narnia' });
    expect(fallo.campo).toBe('zonaHoraria');
    expect(fallo.claves[0]).toContain('validacion.ZONA_HORARIA_INVALIDA');
  });

  it('ambos campos son opcionales (el frontend anterior no los manda)', async () => {
    expect(await errores({ nombre: 'Prueba Globalización' })).toEqual([]);
  });
});
