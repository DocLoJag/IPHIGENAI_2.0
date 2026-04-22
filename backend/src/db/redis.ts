import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let connection: Redis | null = null;

export function redis(): Redis {
  if (connection) return connection;
  const c = new Redis(env.REDIS_URL, {
    // BullMQ richiede questa impostazione per i worker:
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  c.on('error', (err) => {
    console.error('[redis] error', err.message);
  });
  connection = c;
  return c;
}

export async function closeRedis(): Promise<void> {
  if (connection) await connection.quit();
  connection = null;
}
