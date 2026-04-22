import { pgTable, primaryKey, real, text, timestamp } from 'drizzle-orm/pg-core';
import { topicState } from './enums.js';
import { users } from './users.js';

export const topicNodes = pgTable(
  'topic_nodes',
  {
    id: text('id').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    label: text('label').notNull(),
    subject: text('subject'),
    state: topicState('state').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    r: real('r').notNull().default(6),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.id] }),
  }),
);

export const topicEdges = pgTable(
  'topic_edges',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    nodeA: text('node_a').notNull(),
    nodeB: text('node_b').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.nodeA, t.nodeB] }),
  }),
);

export type TopicNodeRow = typeof topicNodes.$inferSelect;
export type TopicEdgeRow = typeof topicEdges.$inferSelect;
