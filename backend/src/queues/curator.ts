import { Queue, type QueueOptions } from 'bullmq';
import { redis } from '../db/redis.js';
import { db } from '../db/postgres.js';
import { jobLog } from '../db/schema.js';

export const CURATOR_QUEUE = 'curator';

export type CuratorJobData = {
  sessionId: string;
};

let queue: Queue<CuratorJobData> | null = null;

export function curatorQueue(): Queue<CuratorJobData> {
  if (!queue) {
    const opts: QueueOptions = {
      connection: redis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 500 },
        removeOnFail: { age: 60 * 60 * 24 * 30, count: 500 },
      },
    };
    queue = new Queue<CuratorJobData>(CURATOR_QUEUE, opts);
  }
  return queue;
}

export async function enqueueCuratorJob(data: CuratorJobData): Promise<void> {
  // jobId con timestamp per evitare collisioni. L'idempotency reale è applicativa
  // (`runCuratorForSession` skippa se la nota Mongo per quella sessione esiste già):
  // un jobId puramente deterministico bloccherebbe i re-enqueue dopo reset-demo,
  // perché BullMQ trattiene jobId completed nel set per `removeOnComplete.age`.
  // BullMQ 5 non accetta ':' nei custom jobId — usiamo '-' come separatore.
  await curatorQueue().add('run-curator', data, {
    jobId: `curator-${data.sessionId}-${Date.now()}`,
  });

  await db.insert(jobLog).values({
    jobName: 'curator:run-curator',
    refType: 'session',
    refId: data.sessionId,
    payload: data as unknown as Record<string, unknown>,
    status: 'queued',
  });
}

export async function closeCuratorQueue(): Promise<void> {
  if (queue) await queue.close();
  queue = null;
}
