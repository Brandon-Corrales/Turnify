import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapIntegrationApp } from '../../test-utils/bootstrap-integration-app';

/**
 * Tests de INTEGRACIÓN reales (punto 19/QA del brief): a diferencia de
 * `auth.service.spec.ts` (que instancia `AuthService` a mano con mocks),
 * esto levanta la app completa (`AppModule`, guards globales,
 * `ValidationPipe`, `AllExceptionsFilter`, TypeORM contra la base real
 * que apunte `.env`) y dispara requests HTTP reales con `supertest` —
 * el mismo camino que recorre un cliente real, sin atajos.
 *
 * Cada `describe` usa su PROPIO negocio/usuario (registrado vía la API
 * real, con sufijo de timestamp) para no depender de datos de seed
 * compartidos y para no mezclar el estado de `refreshTokenHash` entre
 * escenarios que lo mutan (login/refresh sobrescriben ese campo en cada
 * llamada) — mismo criterio ya usado en el E2E de Playwright.
 *
 * `/auth/registro`, `/auth/login` y `/auth/refresh` tienen su propio
 * límite de 5 solicitudes/minuto (más estricto que el global) — el
 * número de llamadas a cada uno se mantiene deliberadamente bajo en
 * este archivo para no toparlo.
 */
describe('Auth (integración HTTP real)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapIntegrationApp();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('registro, sesión y perfil', () => {
    const sufijo = Date.now();
    const correoAdmin = `it-admin-${sufijo}@example.com`;
    const contrasena = 'Turnify123!';
    const dtoRegistro = {
      nombreNegocio: `Negocio IT ${sufijo}`,
      tipoNegocio: 'barberia',
      correoNegocio: `it-negocio-${sufijo}@example.com`,
      nombreCompletoAdmin: 'Admin IT',
      correoAdmin,
      contrasena,
    };
    let accessToken: string;

    it('POST /auth/registro crea el negocio+admin reales y devuelve tokens sin exponer el hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/registro')
        .send(dtoRegistro)
        .expect(201);

      expect(res.body.usuario).toEqual(
        expect.objectContaining({ correoElectronico: correoAdmin, rol: 'admin' }),
      );
      expect(res.body.usuario).not.toHaveProperty('contrasenaHash');
      expect(res.body.tokens.accessToken).toEqual(expect.any(String));
      expect(res.body.tokens.refreshToken).toEqual(expect.any(String));
      accessToken = res.body.tokens.accessToken;
    });

    it('POST /auth/registro con el mismo correo responde 409 EMAIL_YA_REGISTRADO', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/registro')
        .send(dtoRegistro)
        .expect(409);
      expect(res.body.errorCode).toBe('EMAIL_YA_REGISTRADO');
    });

    it('GET /auth/me sin Authorization responde 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('GET /auth/me con el access token real devuelve el perfil del usuario recién creado', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.correoElectronico).toBe(correoAdmin);
    });

    it('POST /auth/login con contraseña incorrecta responde 401 CREDENCIALES_INVALIDAS', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correoElectronico: correoAdmin, contrasena: 'incorrecta' })
        .expect(401);
      expect(res.body.errorCode).toBe('CREDENCIALES_INVALIDAS');
    });

    it('POST /auth/login con credenciales correctas emite un access token válido de verdad', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correoElectronico: correoAdmin, contrasena })
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
        .expect(200);
    });
  });

  describe('rotación de refresh token, detección de reuso y logout', () => {
    const sufijo = Date.now() + 1;
    const correoAdmin = `it-refresh-${sufijo}@example.com`;

    let refreshTokenOriginal: string;
    let refreshTokenRotado: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({
          nombreNegocio: `Negocio Refresh IT ${sufijo}`,
          tipoNegocio: 'barberia',
          correoNegocio: `it-refresh-negocio-${sufijo}@example.com`,
          nombreCompletoAdmin: 'Admin Refresh IT',
          correoAdmin,
          contrasena: 'Turnify123!',
        });
      refreshTokenOriginal = res.body.tokens.refreshToken;
    });

    it('POST /auth/refresh con el token vigente rota el par y el nuevo access token funciona', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenOriginal })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).not.toBe(refreshTokenOriginal);
      refreshTokenRotado = res.body.refreshToken;

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('SEGURIDAD — reusar el refresh token YA ROTADO responde 401 y revoca la sesión entera', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenOriginal })
        .expect(401);
      expect(res.body.errorCode).toBe('REFRESH_TOKEN_INVALIDO');

      // La sesión quedó revocada por completo: hasta el token vigente
      // (el que SÍ era válido un segundo antes) deja de servir — este
      // es el efecto real, extremo a extremo, de la detección de reuso
      // que auth.service.spec.ts ya prueba a nivel de servicio.
      const res2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenRotado })
        .expect(401);
      expect(res2.body.errorCode).toBe('REFRESH_TOKEN_INVALIDO');
    });

    it('POST /auth/logout invalida la sesión (un refresh posterior con el token vigente falla)', async () => {
      // Sesión nueva: la anterior ya quedó revocada por el test de reuso.
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correoElectronico: correoAdmin, contrasena: 'Turnify123!' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.tokens.refreshToken })
        .expect(401);
    });
  });
});
