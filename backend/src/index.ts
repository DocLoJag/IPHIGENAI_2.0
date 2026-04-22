import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo, ensureMongoIndexes, closeMongo } from './db/mongo.js';
import { closePostgres } from './db/postgres.js';
import { closeRedis } from './db/redis.js';

async function main(): Promise<void> {
  await connectMongo();
  await ensureMongoIndexes();

  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} ricevuto, shutdown`);
    try {
      await app.close();
      await closeMongo();
      await closeRedis();
      await closePostgres();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[api] fatal', err);
  process.exit(1);
});
