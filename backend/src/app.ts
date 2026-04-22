import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import authPlugin from './auth/plugin.js';
import authRoutes from './routes/auth.js';
import studentsRoutes from './routes/students.js';
import sessionsRoutes from './routes/sessions.js';
import aiThreadsRoutes from './routes/ai-threads.js';
import humanThreadsRoutes from './routes/threads.js';
import artifactsRoutes from './routes/artifacts.js';
import adminRoutes from './routes/admin.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
    },
    trustProxy: true, // necessario dietro Railway
    disableRequestLogging: env.NODE_ENV === 'production',
  });

  await app.register(sensible);

  await app.register(cors, {
    origin: [env.FRONTEND_ORIGIN],
    credentials: true, // necessario per cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(authPlugin);

  // ─── health ────────────────────────────────────────
  app.get('/health', async () => ({ ok: true, now: new Date().toISOString() }));

  // ─── API v1 ────────────────────────────────────────
  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(studentsRoutes);
      await v1.register(sessionsRoutes);
      await v1.register(aiThreadsRoutes);
      await v1.register(humanThreadsRoutes);
      await v1.register(artifactsRoutes);
      await v1.register(adminRoutes);
    },
    { prefix: '/api' },
  );

  // ─── error handler ────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.status).send({ message: err.message, code: err.code });
      return;
    }
    if (err instanceof ZodError) {
      reply
        .code(400)
        .send({ message: 'Richiesta non valida', code: 'VALIDATION', issues: err.errors });
      return;
    }
    const status =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({
      message: status >= 500 ? 'Errore interno' : err.message,
      code: 'INTERNAL',
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ message: 'Endpoint non trovato', code: 'NOT_FOUND' });
  });

  return app;
}
