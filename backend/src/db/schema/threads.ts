import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { messageKind } from './enums.js';
import { users } from './users.js';

// thread 1:1 studente ↔ tutor umano
export const threads = pgTable('threads', {
  id: text('id').primaryKey(),
  participants: text('participants').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    fromUser: text('from_user')
      .notNull()
      .references(() => users.id),
    kind: messageKind('kind').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    text: text('text').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => ({
    byThreadTime: index('messages_thread_time').on(t.threadId, t.at),
  }),
);

// thread AI (corpo messaggi in Mongo)
export const aiThreads = pgTable('ai_threads', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  subject: text('subject'),
  topic: text('topic'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export type ThreadRow = typeof threads.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AiThreadRow = typeof aiThreads.$inferSelect;
