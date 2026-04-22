import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sessionStatus } from './enums.js';
import { users } from './users.js';

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    subject: text('subject').notNull(),
    topic: text('topic').notNull(),
    focus: text('focus'),
    status: sessionStatus('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    completedCount: integer('completed_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    elapsedMinutes: integer('elapsed_minutes').notNull().default(0),
    resumeBlurb: text('resume_blurb'),
    nextExerciseId: text('next_exercise_id'),
  },
  (t) => ({
    byStudentStatus: index('sessions_student_status').on(
      t.studentId,
      t.status,
      t.lastTouchedAt,
    ),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
