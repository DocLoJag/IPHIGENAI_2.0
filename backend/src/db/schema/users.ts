import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { userRole } from './enums.js';

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

export type UserRow = typeof users.$inferSelect;
export type StudentRow = typeof students.$inferSelect;
