import { Worker, type WorkerOptions } from 'bullmq';
import { redis } from '../db/redis.js';
import { CURATOR_QUEUE, type CuratorJobData } from '../queues/curator.js';
import { runCuratorForSession } from '../services/curator.js';
import { db } from '../db/postgres.js';
import { jobLog } from '../db/schema/index.js';
import { and, desc, eq } from 'drizzle-orm';

export function startCuratorWorker(): Worker<CuratorJobData> {
  const opts: WorkerOptions = {
    connection: redis(),
    concurrency: 2, // il curator usa Opus: teniamo basso
  };

  const worker = new Worker<CuratorJobData>(
    CURATOR_QUEUE,
    async (job) => {
      console.log(`[curator-worker] job ${job.id} start — sessionId=${job.data.sessionId}`);
      await runCuratorForSession(job.data.sessionId);
    },
    opts,
  );

  worker.on('completed', async (job) => {
    await markJobLog(job.data.sessionId, 'done', null);
  });

  worker.on('failed', async (job, err) => {
    const sid = job?.data.sessionId;
    if (sid) await markJobLog(sid, 'failed', err?.message ?? 'errore sconosciuto');
    console.error('[curator-worker] failed', job?.id, err);
  });

  worker.on('error', (err) => {
    console.error('[curator-worker] error', err);
  });

  return worker;
}

async function markJobLog(sessionId: string, status: string, error: string | null): Promise<void> {
  // aggiorniamo la riga più recente per quella session_id
  const rows = await db
    .select()
    .from(jobLog)
    .where(and(eq(jobLog.refType, 'session'), eq(jobLog.refId, sessionId)))
    .orderBy(desc(jobLog.runAt))
    .limit(1);
  if (rows.length === 0) return;
  await db.update(jobLog).set({ status, error }).where(eq(jobLog.id, rows[0]!.id));
}
