import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve essere almeno 32 caratteri'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string().url(),
  MONGO_URL: z.string(),
  MONGO_DB: z.string().default('iphigenai'),
  REDIS_URL: z.string(),

  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY mancante'),
  ANTHROPIC_MODEL_TUTOR: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MODEL_CURATOR: z.string().default('claude-opus-4-5'),

  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configurazione non valida:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
