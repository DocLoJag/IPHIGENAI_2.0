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
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { id as genId } from '../lib/ids.js';
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

async function assertTutorOwnsActivity(tutorId: string, activityId: string) {
  const [a] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!a) throw notFound('Attività non trovata');
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.userId, a.studentId))
    .limit(1);
  if (!s || s.tutorId !== tutorId) {
    throw forbidden('Attività non assegnata a uno studente di questo tutor');
  }
  return a;
}

// Serializer esteso: include campi di scheduling/stato che il tutor deve
// vedere per confermare che la propria write abbia avuto effetto.
// Non sostituisce serializeActivity (usato nel bundle home dello studente),
// che resta minimale di proposito.
function serializeTutorActivity(a: typeof activities.$inferSelect) {
  return {
    id: a.id,
    student_id: a.studentId,
    kind: a.kind,
    subject: a.subject,
    title: a.title,
    kicker: a.kicker,
    estimated_minutes: a.estimatedMinutes,
    prepared_by: a.preparedBy,
    prepared_at: a.preparedAt?.toISOString() ?? null,
    priority: a.priority,
    linked_session_id: a.linkedSessionId,
    scheduled_for: a.scheduledFor?.toISOString() ?? null,
    dismissed_at: a.dismissedAt?.toISOString() ?? null,
    completed_at: a.completedAt?.toISOString() ?? null,
  };
}

const activityKindSchema = z.enum([
  'review',
  'guided-reading',
  'quick-test',
  'analysis',
  'writing',
  'exercise-set',
  'reading',
]);

const createActivityBody = z
  .object({
    kind: activityKindSchema,
    subject: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    kicker: z.string().trim().max(500).nullable().optional(),
    estimated_minutes: z.number().int().positive().max(600).nullable().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
    scheduled_for: z.string().datetime({ offset: true }).nullable().optional(),
    linked_session_id: z.string().min(1).nullable().optional(),
  })
  .strict();

const patchActivityBody = z
  .object({
    kind: activityKindSchema.optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    kicker: z.string().trim().max(500).nullable().optional(),
    estimated_minutes: z.number().int().positive().max(600).nullable().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
    scheduled_for: z.string().datetime({ offset: true }).nullable().optional(),
    linked_session_id: z.string().min(1).nullable().optional(),
    // Unico uso ammesso: ripristinare un'attività scartata passando null.
    // Per scartare un'attività si usa DELETE (soft-delete).
    dismissed_at: z.null().optional(),
  })
  .strict();

async function assertSessionBelongsToStudent(sessionId: string, studentId: string) {
  const [sess] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!sess) throw badRequest('Sessione collegata non trovata', 'LINKED_SESSION_NOT_FOUND');
  if (sess.studentId !== studentId) {
    throw badRequest(
      'La sessione collegata non appartiene a questo studente',
      'LINKED_SESSION_MISMATCH',
    );
  }
}

// Alternativa a schema.parse() che garantisce 400 VALIDATION come status.
// L'errorHandler globale in src/app.ts dovrebbe catturare ZodError, ma in
// pratica non lo fa (probabilmente sovrascritto dallo scope del plugin);
// questo helper usa safeParse e rilancia una AppError normale, evitando il 500.
function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest('Richiesta non valida', 'VALIDATION');
  }
  return r.data;
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

  // POST /tutor/students/:id/activities — crea una nuova attività per lo studente
  app.post<{ Params: { id: string } }>(
    '/tutor/students/:id/activities',
    guard,
    async (req, reply) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const body = parseBody(createActivityBody, req.body ?? {});

      if (body.linked_session_id) {
        await assertSessionBelongsToStudent(body.linked_session_id, studentId);
      }

      const now = new Date();
      const newId = genId.activity();

      const [row] = await db
        .insert(activities)
        .values({
          id: newId,
          studentId,
          kind: body.kind,
          subject: body.subject,
          title: body.title,
          kicker: body.kicker ?? null,
          estimatedMinutes: body.estimated_minutes ?? null,
          preparedBy: tutorId,
          preparedAt: now,
          priority: body.priority ?? 100,
          linkedSessionId: body.linked_session_id ?? null,
          scheduledFor: body.scheduled_for ? new Date(body.scheduled_for) : null,
        })
        .returning();

      if (!row) throw notFound('Creazione attività fallita');
      reply.code(201);
      return serializeTutorActivity(row);
    },
  );

  // PATCH /tutor/activities/:id — modifica un'attività esistente
  app.patch<{ Params: { id: string } }>(
    '/tutor/activities/:id',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const activityId = req.params.id;
      const current = await assertTutorOwnsActivity(tutorId, activityId);

      const body = parseBody(patchActivityBody, req.body ?? {});

      if (body.linked_session_id) {
        await assertSessionBelongsToStudent(body.linked_session_id, current.studentId);
      }

      const patch: Partial<typeof activities.$inferInsert> = {};
      if (body.kind !== undefined) patch.kind = body.kind;
      if (body.subject !== undefined) patch.subject = body.subject;
      if (body.title !== undefined) patch.title = body.title;
      if (body.kicker !== undefined) patch.kicker = body.kicker;
      if (body.estimated_minutes !== undefined) patch.estimatedMinutes = body.estimated_minutes;
      if (body.priority !== undefined) patch.priority = body.priority;
      if (body.scheduled_for !== undefined) {
        patch.scheduledFor = body.scheduled_for ? new Date(body.scheduled_for) : null;
      }
      if (body.linked_session_id !== undefined) {
        patch.linkedSessionId = body.linked_session_id;
      }
      if (body.dismissed_at !== undefined) {
        // solo null ammesso dal validator: serve a ripristinare un'attività scartata
        patch.dismissedAt = null;
      }

      if (Object.keys(patch).length === 0) {
        // niente da cambiare: restituisco lo stato attuale senza toccare il DB
        return serializeTutorActivity(current);
      }

      const [row] = await db
        .update(activities)
        .set(patch)
        .where(eq(activities.id, activityId))
        .returning();

      if (!row) throw notFound('Attività non trovata');
      return serializeTutorActivity(row);
    },
  );

  // DELETE /tutor/activities/:id — scarta (soft-delete) un'attività
  app.delete<{ Params: { id: string } }>(
    '/tutor/activities/:id',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const activityId = req.params.id;
      await assertTutorOwnsActivity(tutorId, activityId);

      const now = new Date();
      const [row] = await db
        .update(activities)
        .set({ dismissedAt: now })
        .where(eq(activities.id, activityId))
        .returning();

      if (!row) throw notFound('Attività non trovata');
      return serializeTutorActivity(row);
    },
  );
}
