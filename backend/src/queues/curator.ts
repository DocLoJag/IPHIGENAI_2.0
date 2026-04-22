import { Queue, type QueueOptions } from 'bullmq';
import { redis } from '../db/redis.js';
import { db } from '../db/postgres.js';
import { jobLog } from '../db/schema/index.js';

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
  // exactly-once per sessione: jobId = sessionId. Se già in coda, BullMQ lo scarta.
  await curatorQueue().add('run-curator', data, { jobId: `curator:${data.sessionId}` });

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
