import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 5,
  prepare: false, // playback-friendly; meno stato server-side
});

export const db = drizzle(queryClient, { schema });
export const sql = queryClient;
export type Database = typeof db;

export async function closePostgres(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
