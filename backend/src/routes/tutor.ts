import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import {
  activities,
  completions,
  sessions,
  students,
  users,
} from '../db/schema.js';
import { collections } from '../db/mongo.js';
import { forbidden, notFound } from '../lib/errors.js';
import {
  serializeActivity,
  serializeCompletion,
  serializeSession,
} from './students.js';

// Guard unico: tutte le rotte richiedono role=tutor.
// L'ownership (tutor proprietario dello studente target) è verificata
// dentro ogni handler che riceve :id, perché requireRole da solo non basta
// a impedire a tutor_A di guardare i dati degli studenti di tutor_B.

async function assertTutorOwnsStudent(tutorId: string, studentId: string) {
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.userId, studentId))
    .limit(1);
  if (!s) throw notFound('Studente non trovato');
  if (s.tutorId !== tutorId) throw forbidden('Studente non assegnato a questo tutor');
  return s;
}

function serializeCuratorNote(n: {
  session_id: string;
  written_at: Date;
  body: string;
  signals?: {
    topic?: string;
    confidence?: number;
    stumble_points?: string[];
    next_step_hint?: string;
  };
}) {
  return {
    session_id: n.session_id,
    written_at: n.written_at.toISOString(),
    body: n.body,
    signals: n.signals ?? {},
  };
}

export default async function tutorRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('tutor')] };

  // GET /tutor/students — lista studenti assegnati al tutor loggato
  app.get('/tutor/students', guard, async (req) => {
    const tutorId = req.principal!.sub;

    const rows = await db
      .select({
        u: users,
        s: students,
      })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(and(eq(students.tutorId, tutorId), isNull(users.disabledAt)))
      .orderBy(users.name);

    // Per ogni studente, ultima sessione (qualsiasi status) per dare un hint di "quando era vivo"
    const items = await Promise.all(
      rows.map(async ({ u, s }) => {
        const [last] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.studentId, u.id))
          .orderBy(desc(sessions.lastTouchedAt))
          .limit(1);

        return {
          id: u.id,
          username: u.username,
          name: u.name,
          full_name: u.fullName,
          avatar_initial: u.avatarInitial,
          grade: s.grade,
          school: s.school,
          last_session_at: last?.lastTouchedAt.toISOString() ?? null,
          last_session_subject: last?.subject ?? null,
          last_session_status: last?.status ?? null,
        };
      }),
    );

    return { items, total: items.length };
  });

  // GET /tutor/students/:id/overview — bundle panoramica per un singolo studente
  app.get<{ Params: { id: string } }>(
    '/tutor/students/:id/overview',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      const s = await assertTutorOwnsStudent(tutorId, studentId);

      const [u] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
      if (!u) throw notFound('Studente non trovato');

      const recentSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.studentId, studentId))
        .orderBy(desc(sessions.lastTouchedAt))
        .limit(10);

      const now = new Date();
      const upcomingActivities = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.studentId, studentId),
            isNull(activities.completedAt),
            isNull(activities.dismissedAt),
            or(isNull(activities.scheduledFor), lte(activities.scheduledFor, now)),
          ),
        )
        .orderBy(activities.priority)
        .limit(10);

      const recentCompletions = await db
        .select()
        .from(completions)
        .where(eq(completions.studentId, studentId))
        .orderBy(desc(completions.completedAt))
        .limit(10);

      const lastCuratorNote = await collections
        .curatorNotebook()
        .findOne({ student_id: studentId }, { sort: { written_at: -1 } });

      return {
        student: {
          id: u.id,
          username: u.username,
          name: u.name,
          full_name: u.fullName,
          avatar_initial: u.avatarInitial,
          grade: s.grade,
          school: s.school,
        },
        recent_sessions: recentSessions.map(serializeSession),
        upcoming_activities: upcomingActivities.map(serializeActivity),
        recent_completions: recentCompletions.map(serializeCompletion),
        last_curator_note: lastCuratorNote ? serializeCuratorNote(lastCuratorNote) : null,
      };
    },
  );

  // GET /tutor/students/:id/notebook — storico note curator per lo studente (paginato)
  const notebookQuery = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
  });

  app.get<{ Params: { id: string } }>(
    '/tutor/students/:id/notebook',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const { limit } = notebookQuery.parse(req.query ?? {});

      const notes = await collections
        .curatorNotebook()
        .find({ student_id: studentId })
        .sort({ written_at: -1 })
        .limit(limit)
        .toArray();

      return {
        items: notes.map(serializeCuratorNote),
        total: notes.length,
      };
    },
  );
}
