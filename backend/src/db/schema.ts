/*
 * Schema unico.
 *
 * Motivazione: drizzle-kit (v0.30) ha problemi con import cross-file che usano
 * l'estensione .js (richiesta da NodeNext + ESM). Tenere lo schema in un unico
 * file elimina il problema e semplifica la lettura.
 */
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// ─── enums ──────────────────────────────────────────────────────────
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

// ─── users / students ───────────────────────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  role: userRole('role').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name'),
  avatarInitial: text('avatar_initial'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
});

export const students = pgTable('students', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  grade: text('grade'),
  school: text('school'),
  tutorId: text('tutor_id').references(() => users.id),
});

// ─── sessions ───────────────────────────────────────────────────────
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

// ─── exercises ──────────────────────────────────────────────────────
export type ExerciseChoice = { id: string; letter: string; text: string };

export const exercises = pgTable('exercises', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  ofTotal: integer('of_total').notNull(),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  prompt: text('prompt').notNull(),
  formula: text('formula'),
  choices: jsonb('choices').$type<ExerciseChoice[]>().notNull(),
  correctChoiceId: text('correct_choice_id'),
  hint: text('hint'),
});

export const exerciseAttempts = pgTable('exercise_attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  choiceId: text('choice_id'),
  correct: boolean('correct'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  feedbackText: text('feedback_text'),
});

// ─── activities / completions ───────────────────────────────────────
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

// ─── threads (tutor umano) ──────────────────────────────────────────
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

// ─── AI threads (corpo messaggi in Mongo) ───────────────────────────
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

// ─── topics (costellazione materie) ─────────────────────────────────
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

// ─── artifacts (corpo in Mongo) ─────────────────────────────────────
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

// ─── tutor notes (appunti privati del tutor sullo studente) ────────
export const tutorNotes = pgTable(
  'tutor_notes',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    tutorId: text('tutor_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byStudentRecent: index('tutor_notes_student_recent').on(t.studentId, t.createdAt),
    byTutorStudent: index('tutor_notes_tutor_student').on(t.tutorId, t.studentId),
  }),
);

// ─── job log (outbox BullMQ) ────────────────────────────────────────
export const jobLog = pgTable('job_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jobName: text('job_name').notNull(),
  refType: text('ref_type'),
  refId: text('ref_id'),
  payload: jsonb('payload'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull(),
  error: text('error'),
});

// ─── row types ──────────────────────────────────────────────────────
export type UserRow = typeof users.$inferSelect;
export type StudentRow = typeof students.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type ExerciseAttemptRow = typeof exerciseAttempts.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type CompletionRow = typeof completions.$inferSelect;
export type ThreadRow = typeof threads.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AiThreadRow = typeof aiThreads.$inferSelect;
export type TopicNodeRow = typeof topicNodes.$inferSelect;
export type TopicEdgeRow = typeof topicEdges.$inferSelect;
export type ArtifactRow = typeof artifacts.$inferSelect;
export type TutorNoteRow = typeof tutorNotes.$inferSelect;
export type JobLogRow = typeof jobLog.$inferSelect;
