import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const artifacts = pgTable(
  'artifacts',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    kind: text('kind').notNull(), // simulation|concept-map|interactive-diagram|...
    subject: text('subject'),
    description: text('description'),
    tags: text('tags').array().notNull().default([]),
    preview: text('preview'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byStudentSubject: index('artifacts_student_subject').on(t.studentId, t.subject),
  }),
);

export type ArtifactRow = typeof artifacts.$inferSelect;
