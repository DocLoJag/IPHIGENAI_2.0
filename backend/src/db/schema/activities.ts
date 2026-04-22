import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { activityKind } from './enums.js';
import { sessions } from './sessions.js';
import { users } from './users.js';

export const activities = pgTable(
  'activities',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    kind: activityKind('kind').notNull(),
    subject: text('subject').notNull(),
    title: text('title').notNull(),
    kicker: text('kicker'),
    estimatedMinutes: integer('estimated_minutes'),
    preparedBy: text('prepared_by').references(() => users.id),
    preparedAt: timestamp('prepared_at', { withTimezone: true }),
    priority: integer('priority').notNull().default(100),
    linkedSessionId: text('linked_session_id').references(() => sessions.id),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    byStudentVisible: index('activities_student_visible').on(
      t.studentId,
      t.scheduledFor,
      t.completedAt,
      t.dismissedAt,
    ),
  }),
);

export const completions = pgTable(
  'completions',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    kind: activityKind('kind').notNull(),
    subject: text('subject').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes'),
    outcome: text('outcome'),
    sourceSessionId: text('source_session_id').references(() => sessions.id),
    sourceActivityId: text('source_activity_id').references(() => activities.id),
  },
  (t) => ({
    byStudentRecent: index('completions_student_recent').on(t.studentId, t.completedAt),
  }),
);

export type ActivityRow = typeof activities.$inferSelect;
export type CompletionRow = typeof completions.$inferSelect;
