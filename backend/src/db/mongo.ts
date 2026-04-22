import { MongoClient, type Db, type Collection, type Document } from 'mongodb';
import { env } from '../config/env.js';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) return database;
  client = new MongoClient(env.MONGO_URL, { maxPoolSize: 10 });
  await client.connect();
  database = client.db(env.MONGO_DB);
  return database;
}

export function mongo(): Db {
  if (!database) throw new Error('MongoDB non connesso — chiamare connectMongo() prima.');
  return database;
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
  client = null;
  database = null;
}

// Schemi (solo a titolo documentale — Mongo non valida).
export type CuratorNote = {
  student_id: string;
  session_id: string;
  written_at: Date;
  voice: 'curator';
  body: string;
  signals: {
    topic?: string;
    confidence?: number;
    stumble_points?: string[];
    next_step_hint?: string;
  };
};

export type AiMessageDoc = {
  thread_id: string;
  seq: number;
  from: 'ai' | 'student';
  at: Date;
  text: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  tool_calls?: unknown[];
  citations?: unknown[];
};

export type ArtifactBody = {
  _id: string;
  kind: string;
  schema_version: number;
  [key: string]: unknown;
};

export const collections = {
  curatorNotebook: (): Collection<CuratorNote & Document> =>
    mongo().collection<CuratorNote & Document>('curator_notebook'),
  aiMessages: (): Collection<AiMessageDoc & Document> =>
    mongo().collection<AiMessageDoc & Document>('ai_messages'),
  artifactBodies: (): Collection<ArtifactBody & Document> =>
    mongo().collection<ArtifactBody & Document>('artifact_bodies'),
};

export async function ensureMongoIndexes(): Promise<void> {
  await collections.curatorNotebook().createIndex({ student_id: 1, written_at: -1 });
  await collections.curatorNotebook().createIndex({ session_id: 1 }, { unique: true });
  await collections.aiMessages().createIndex({ thread_id: 1, seq: 1 }, { unique: true });
  await collections.aiMessages().createIndex({ thread_id: 1, at: 1 });
}
