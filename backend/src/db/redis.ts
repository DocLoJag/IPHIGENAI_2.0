import IORedis, { type Redis } from 'ioredis';
import { env } from '../config/env.js';

let connection: Redis | null = null;

export function redis(): Redis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      // BullMQ richiede questa impostazione per i worker:
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    connection.on('error', (err) => {
      console.error('[redis] error', err.message);
    });
  }
  return connection;
}

export async function closeRedis(): Promise<void> {
  if (connection) await connection.quit();
  connection = null;
}
