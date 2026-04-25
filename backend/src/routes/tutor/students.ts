/*
 * Rotte read-only sugli studenti del tutor.
 * - GET  /tutor/students                         lista
 * - GET  /tutor/students/:id/overview            bundle panoramica
 * - GET  /tutor/students/:id/notebook            storico note curator
 */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/postgres.js';
import {
  activities,
  completions,
  sessions,
  students,
  users,
} from '../../db/schema.js';
import { collections } from '../../db/mongo.js';
import { notFound } from '../../lib/errors.js';
import { serializeCompletion, serializeSession } from '../serializers.js';
import { assertTutorOwnsStudent } from './guards.js';
import { serializeCuratorNote, serializeTutorActivity } from './serializers.js';

const notebookQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const dismissedQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export default async function tutorStudentsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('tutor')] };

  // GET /tutor/students — lista studenti assegnati al tutor loggato
  app.get('/tutor/students', guard, async (req) => {
    const tutorId = req.principal!.sub;

    const rows = await db
      .select({ u: users, s: students })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(and(eq(students.tutorId, tutorId), isNull(users.disabledAt)))
      .orderBy(users.name);

    // Risolvo "ultima sessione per studente" con UNA query invece di N+1.
    // Carico tutte le sessioni dei miei studenti ordinate per (studentId, lastTouched DESC)
    // e tengo la prima per ogni studentId, in memoria. Per il pilota (max ~10 studenti
    // per tutor) è l'approccio più semplice e tipato; la query ha l'indice
    // sessions_student_status su (studentId, status, lastTouchedAt).
    const studentIds = rows.map((r) => r.u.id);
    const lastByStudent = new Map<string, typeof sessions.$inferSelect>();
    if (studentIds.length > 0) {
      const allSessions = await db
        .select()
        .from(sessions)
        .where(inArray(sessions.studentId, studentIds))
        .orderBy(sessions.studentId, desc(sessions.lastTouchedAt));
      for (const sess of allSessions) {
        if (!lastByStudent.has(sess.studentId)) {
          lastByStudent.set(sess.studentId, sess);
        }
      }
    }

    const items = rows.map(({ u, s }) => {
      const last = lastByStudent.get(u.id);
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
    });

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

      // Il tutor vede anche le activity programmate per il futuro (scheduled_for > now):
      // serve per gestirle / modificarle / cancellarle. Lo studente invece vede solo
      // quelle "attive ora" (filtro lte sta nel bundle home in routes/students.ts).
      const upcomingActivities = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.studentId, studentId),
            isNull(activities.completedAt),
            isNull(activities.dismissedAt),
          ),
        )
        .orderBy(activities.priority)
        .limit(20);

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
        upcoming_activities: upcomingActivities.map(serializeTutorActivity),
        recent_completions: recentCompletions.map(serializeCompletion),
        last_curator_note: lastCuratorNote ? serializeCuratorNote(lastCuratorNote) : null,
      };
    },
  );

  // GET /tutor/students/:id/dismissed-activities — lista activity scartate per ripristino.
  // Ordinata per dismissedAt DESC (le più recenti in cima). Non incluso nel bundle
  // overview perché è una vista "di servizio": il tutor lo apre solo quando vuole
  // ripescare qualcosa che aveva scartato.
  app.get<{ Params: { id: string } }>(
    '/tutor/students/:id/dismissed-activities',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const { limit } = dismissedQuery.parse(req.query ?? {});

      const items = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.studentId, studentId),
            isNotNull(activities.dismissedAt),
            isNull(activities.completedAt),
          ),
        )
        .orderBy(desc(activities.dismissedAt))
        .limit(limit);

      return {
        items: items.map(serializeTutorActivity),
        total: items.length,
      };
    },
  );

  // GET /tutor/students/:id/notebook — storico note curator per lo studente (paginato)
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
