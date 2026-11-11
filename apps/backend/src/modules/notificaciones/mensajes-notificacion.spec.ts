import { describe, expect, it } from 'vitest';
import { escaparHtml } from './mensajes-notificacion';

describe('Sanitización de HTML en notificaciones', () => {
  it('escapa caracteres especiales de HTML', () => {
    expect(escaparHtml('Corte & Peinado <script>alert(1)</script>')).toBe(
      'Corte &amp; Peinado &lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapa atributos peligrosos como img onerror', () => {
    expect(escaparHtml('<img src=x onerror="alert(\'xss\')">')).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;',
    );
  });

  it('mantiene texto seguro sin alterar', () => {
    expect(escaparHtml('Consulta Dental 15:00')).toBe('Consulta Dental 15:00');
  });
});
