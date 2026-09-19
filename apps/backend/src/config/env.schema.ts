import { z } from 'zod';

/**
 * Valida las variables de entorno al arrancar el proceso (CLI de TypeORM,
 * seed, o luego el bootstrap de Nest) para fallar rápido si falta algo,
 * en vez de reventar a medio request.
 */
const envSchema = z.object({
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

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET es obligatorio'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET es obligatorio'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Opcionales a propósito: el worker de Notificaciones detecta su
  // ausencia en tiempo de ejecución y marca la notificación como fallida
  // con un motivo claro, en vez de tumbar el arranque de todo el
  // servidor por un secreto de una feature específica (el token de
  // WhatsApp Cloud API, además, es de prueba y expira en 24h).
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
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
