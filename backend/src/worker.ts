import { connectMongo, closeMongo, ensureMongoIndexes } from './db/mongo.js';
import { closePostgres } from './db/postgres.js';
import { closeRedis } from './db/redis.js';
import { startCuratorWorker } from './workers/curator-worker.js';

async function main(): Promise<void> {
  await connectMongo();
  await ensureMongoIndexes();

  console.log('[worker] avvio curator worker');
  const worker = startCuratorWorker();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} ricevuto, chiudo`);
    await worker.close();
    await closeMongo();
    await closeRedis();
    await closePostgres();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
