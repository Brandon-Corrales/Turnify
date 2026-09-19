import { z } from 'zod';

/**
 * Valida las variables de entorno al arrancar el proceso (CLI de TypeORM,
 * seed, o luego el bootstrap de Nest) para fallar rápido si falta algo,
 * en vez de reventar a medio request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url().optional(),
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
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas o faltantes:\n${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
