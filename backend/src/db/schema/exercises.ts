import { bigserial, boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sessions } from './sessions.js';
import { users } from './users.js';

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

export type ExerciseRow = typeof exercises.$inferSelect;
export type ExerciseAttemptRow = typeof exerciseAttempts.$inferSelect;
