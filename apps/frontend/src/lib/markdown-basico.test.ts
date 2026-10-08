import { describe, expect, it } from 'vitest';
import { parsearEnLinea, parsearMarkdownBasico } from './markdown-basico';

describe('parsearEnLinea()', () => {
  it('convierte **texto** en negrita sin dejar los asteriscos', () => {
    expect(parsearEnLinea('Tienes **4 servicios activos**.')).toEqual([
      { texto: 'Tienes ' },
      { texto: '4 servicios activos', negrita: true },
      { texto: '.' },
    ]);
  });

  it('convierte *texto* en cursiva', () => {
    expect(parsearEnLinea('Ve a *Configuración*')).toEqual([
      { texto: 'Ve a ' },
      { texto: 'Configuración', cursiva: true },
    ]);
  });

  it('no confunde una multiplicación con cursiva', () => {
    expect(parsearEnLinea('2 * 3 * 4')).toEqual([{ texto: '2 * 3 * 4' }]);
  });

  it('deja un ** sin cerrar como texto (respuesta a medio llegar por streaming)', () => {
    expect(parsearEnLinea('Tienes **4 serv')).toEqual([{ texto: 'Tienes **4 serv' }]);
  });

  it('el HTML queda como texto plano, nunca como marcado', () => {
    expect(parsearEnLinea('<img src=x onerror=alert(1)> **ok**')).toEqual([
      { texto: '<img src=x onerror=alert(1)> ' },
      { texto: 'ok', negrita: true },
    ]);
  });
});

describe('parsearMarkdownBasico()', () => {
  it('agrupa viñetas consecutivas en una lista y separa los párrafos', () => {
    const bloques = parsearMarkdownBasico('Pasos:\n- Abre **Clientes**\n- Pulsa Nuevo\n\nListo.');
    expect(bloques).toEqual([
      { tipo: 'parrafo', lineas: [[{ texto: 'Pasos:' }]] },
      {
        tipo: 'lista',
        ordenada: false,
        items: [
          [{ texto: 'Abre ' }, { texto: 'Clientes', negrita: true }],
          [{ texto: 'Pulsa Nuevo' }],
        ],
      },
      { tipo: 'parrafo', lineas: [[{ texto: 'Listo.' }]] },
    ]);
  });

  it('reconoce listas numeradas', () => {
    const bloques = parsearMarkdownBasico('1. Uno\n2. Dos');
    expect(bloques).toEqual([
      { tipo: 'lista', ordenada: true, items: [[{ texto: 'Uno' }], [{ texto: 'Dos' }]] },
    ]);
  });

  it('una línea que empieza con **negrita** no es una viñeta', () => {
    const bloques = parsearMarkdownBasico('**Importante**: revisa tu horario');
    expect(bloques[0]).toMatchObject({ tipo: 'parrafo' });
  });

  it('muestra un encabezado como línea en negrita sin los #', () => {
    expect(parsearMarkdownBasico('### Notificaciones')).toEqual([
      { tipo: 'parrafo', lineas: [[{ texto: 'Notificaciones', negrita: true }]] },
    ]);
  });

  it('líneas seguidas del mismo párrafo se conservan como líneas separadas', () => {
    expect(parsearMarkdownBasico('Hola\nadiós')).toEqual([
      { tipo: 'parrafo', lineas: [[{ texto: 'Hola' }], [{ texto: 'adiós' }]] },
    ]);
  });
});
