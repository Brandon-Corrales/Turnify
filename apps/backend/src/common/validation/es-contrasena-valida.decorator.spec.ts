import { describe, expect, it } from 'vitest';
import { esContrasenaSegura } from './es-contrasena-valida.decorator';

describe('Política de contraseñas seguras', () => {
  it('rechaza contraseñas con menos de 12 caracteres', () => {
    expect(esContrasenaSegura('Abc12345')).toBe(false);
    expect(esContrasenaSegura('Corta123456')).toBe(false); // 11 chars
  });

  it('rechaza contraseñas con más de 64 caracteres', () => {
    const larga = 'A1' + 'a'.repeat(63);
    expect(esContrasenaSegura(larga)).toBe(false);
  });

  it('rechaza contraseñas sin números o sin letras', () => {
    expect(esContrasenaSegura('sololetrasenminusculaymayuscula')).toBe(false);
    expect(esContrasenaSegura('1234567890123456')).toBe(false);
  });

  it('rechaza contraseñas que superen 72 bytes en UTF-8', () => {
    // 24 caracteres multibyte de 4 bytes = 96 bytes
    const multibyte = '🔐'.repeat(24) + 'a1';
    expect(esContrasenaSegura(multibyte)).toBe(false);
  });

  it('rechaza contraseñas pertenecientes a la lista de comunes', () => {
    expect(esContrasenaSegura('password1234')).toBe(false);
    expect(esContrasenaSegura('PASSWORD1234')).toBe(false);
    expect(esContrasenaSegura('turnify12345')).toBe(false);
  });

  it('acepta contraseñas válidas que cumplen todos los criterios', () => {
    expect(esContrasenaSegura('Turnify.Segura.2026')).toBe(true);
    expect(esContrasenaSegura('MiClaveFuerte123')).toBe(true);
  });
});
