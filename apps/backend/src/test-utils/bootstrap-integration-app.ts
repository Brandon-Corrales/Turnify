import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { validationExceptionFactory } from '../common/errors/validation-exception-factory';

/**
 * Bootstrap de la app REAL (todo `AppModule`, no un módulo recortado a
 * mano) para tests de integración con supertest — misma pieza que usan
 * los tests unitarios de servicio/guard NO reemplaza: aquellos
 * instancian una clase con mocks a mano; esto levanta el grafo de DI
 * completo (guards globales, `ValidationPipe`, `AllExceptionsFilter`,
 * interceptor multi-tenant, TypeORM contra la base de datos real que
 * apunte `.env`) y dispara requests HTTP reales contra él, igual que lo
 * haría un cliente real. Sin `app.listen()` — supertest habla
 * directamente con `app.getHttpServer()`, no hace falta un puerto real.
 */
export async function bootstrapIntegrationApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(I18nService)));

  await app.init();
  return app;
}
