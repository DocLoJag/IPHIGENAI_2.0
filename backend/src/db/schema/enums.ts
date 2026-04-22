import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['student', 'tutor', 'admin']);

export const sessionStatus = pgEnum('session_status', ['active', 'paused', 'closed']);

export const activityKind = pgEnum('activity_kind', [
  'review',
  'guided-reading',
  'quick-test',
  'analysis',
  'writing',
  'exercise-set',
  'reading',
]);

export const topicState = pgEnum('topic_state', [
  'consolidated',
  'working-on',
  'fresh',
  'to-review',
  'behind',
]);

export const messageKind = pgEnum('message_kind', ['student', 'tutor']);
