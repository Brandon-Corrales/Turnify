import * as fs from 'fs';
import { z } from 'zod';

const vacioComoIndefinido = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * Valida las variables de entorno al arrancar el proceso (CLI de TypeORM,
 * seed, o luego el bootstrap de Nest) para fallar rápido si falta algo,
 * en vez de reventar a medio request.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USERNAME: z.string().default('turnify'),
    DB_PASSWORD: z.string().default('turnify'),
    DB_NAME: z.string().default('turnify'),
    // Validación del certificado del servidor de base de datos (Bloque 6,
    // punto 6.3). Opcionales: sin ellas la conexión se comporta como antes
    // (ver database/opciones-conexion.ts). Se usa una u otra, no ambas.
    DB_SSL_CA: z.preprocess(
      vacioComoIndefinido,
      z
        .string()
        .refine(
          (valor) => valor.includes('-----BEGIN CERTIFICATE-----'),
          'DB_SSL_CA debe ser el contenido PEM del certificado (empieza con -----BEGIN CERTIFICATE-----)',
        )
        .optional(),
    ),
    DB_SSL_CA_PATH: z.preprocess(
      vacioComoIndefinido,
      z
        .string()
        .refine((ruta) => fs.existsSync(ruta), 'DB_SSL_CA_PATH no apunta a un archivo existente')
        .optional(),
    ),

    // Migraciones al arrancar (Bloque 6, punto 6.4). Desactivado por
    // defecto: en producción se aplican a mano (ver README). Solo "true"
    // lo activa.
    MIGRATIONS_RUN_ON_START: z
      .enum(['true', 'false', ''])
      .default('false')
      .transform((valor) => valor === 'true'),

    JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET es obligatorio'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET es obligatorio'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    TRUST_PROXY: z.string().optional().default('1'),

    // Opcionales a propósito: el worker de Notificaciones detecta su
    // ausencia en tiempo de ejecución y marca la notificación como fallida
    // con un motivo claro, en vez de tumbar el arranque de todo el
    // servidor por un secreto de una feature específica (el token de
    // WhatsApp Cloud API, además, es de prueba y expira en 24h).
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
    // Signing secret del webhook de Resend (empieza con "whsec_"; se copia
    // del dashboard de Resend al registrar el endpoint). Sin él,
    // POST /webhooks/resend responde 503 y no procesa nada.
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

    // Igual de opcionales y por la misma razón: sin ellas, StripeService
    // simplemente no puede iniciar un checkout (mismo patrón que Resend/
    // WhatsApp). Costa Rica no está entre los países soportados por Stripe
    // (ni siquiera en modo de pruebas) — ver PROGRESS.md, limitación
    // geográfica confirmada, no una credencial pendiente de conseguir.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID_PLAN_PAGO: z.string().optional(),

    // Opcional por el mismo motivo: sin ella, ChatbotGateway responde con
    // un mensaje degradado en vez de tumbar el servidor (punto 16 del
    // brief: "manejo de fallas... degradarse a un mensaje amable").
    // Proveedor: Groq (API compatible con el SDK de OpenAI) — el primer
    // proveedor (Gemini) quedó bloqueado a nivel de proyecto de Google
    // Cloud, ver PROGRESS.md. Nombres de variable genéricos a propósito:
    // GroqLlmClient implementa la misma interfaz LlmClient que cualquier
    // otro proveedor futuro.
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().default('openai/gpt-oss-20b'),
  })
  .refine((env) => !(env.DB_SSL_CA && env.DB_SSL_CA_PATH), {
    message: 'Define DB_SSL_CA o DB_SSL_CA_PATH, no ambas',
    path: ['DB_SSL_CA'],
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/** Usado por scripts fuera de Nest (CLI de TypeORM, seed). */
export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = validateEnv(process.env);
  return cachedEnv;
}

/** Usado como `validate` de `ConfigModule.forRoot` para fallar rápido al arrancar Nest. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas o faltantes:\n${details}`);
  }
  return parsed.data;
}
