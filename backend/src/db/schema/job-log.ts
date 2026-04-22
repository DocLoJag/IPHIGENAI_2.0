import { bigserial, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// outbox per audit / idempotenza; la verità resta in Redis (BullMQ)
export const jobLog = pgTable('job_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jobName: text('job_name').notNull(),
  refType: text('ref_type'),
  refId: text('ref_id'),
  payload: jsonb('payload'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull(), // 'queued'|'done'|'failed'
  error: text('error'),
});

export type JobLogRow = typeof jobLog.$inferSelect;
