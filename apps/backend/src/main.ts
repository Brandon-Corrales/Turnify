import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { validationExceptionFactory } from './common/errors/validation-exception-factory';
import { Env } from './config/env.schema';

async function bootstrap() {
  // rawBody: true — el webhook de Stripe necesita el body sin parsear
  // para verificar la firma HMAC (`request.rawBody` en el controller);
  // parsearlo primero invalidaría cualquier verificación de firma.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService<Env, true>);

  const configuredOrigins = config
    .get('CORS_ORIGIN', { infer: true })
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set(
    config.get('NODE_ENV', { infer: true }) === 'development'
      ? [...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173']
      : configuredOrigins,
  );

  app.enableCors({
    origin: (origin, callback) => {
      const normalized = origin ? origin.replace(/\/+$/, '') : origin;
      if (!origin || allowedOrigins.has(origin) || (normalized && allowedOrigins.has(normalized))) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origen CORS no permitido: ${origin}`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(I18nService)));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Turnify API')
    .setDescription('Plataforma de reservas y turnos — EIF409, UNA Costa Rica')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  console.log(`Turnify backend escuchando en http://localhost:${port} (docs en /docs)`);
}

bootstrap();
