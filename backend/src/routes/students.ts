import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import {
  activities,
  artifacts,
  completions,
  messages,
  sessions,
  students,
  threads,
  topicEdges,
  topicNodes,
  users,
} from '../db/schema/index.js';
import { collections } from '../db/mongo.js';
import { forbidden, notFound } from '../lib/errors.js';

function serializeSession(s: typeof sessions.$inferSelect) {
  return {
    id: s.id,
    student_id: s.studentId,
    subject: s.subject,
    topic: s.topic,
    focus: s.focus,
    started_at: s.startedAt.toISOString(),
    last_touched_at: s.lastTouchedAt.toISOString(),
    closed_at: s.closedAt?.toISOString() ?? null,
    status: s.status,
    progress: {
      completed: s.completedCount,
      total: s.totalCount,
      elapsed_minutes: s.elapsedMinutes,
    },
    resume_blurb: s.resumeBlurb,
    next_exercise_id: s.nextExerciseId,
  };
}

function serializeActivity(a: typeof activities.$inferSelect) {
  return {
    id: a.id,
    kind: a.kind,
    subject: a.subject,
    title: a.title,
    kicker: a.kicker,
    estimated_minutes: a.estimatedMinutes,
    prepared_by: a.preparedBy,
    prepared_at: a.preparedAt?.toISOString() ?? null,
    priority: a.priority,
    linked_session_id: a.linkedSessionId,
  };
}

function serializeCompletion(c: typeof completions.$inferSelect) {
  return {
    id: c.id,
    title: c.title,
    kind: c.kind,
    subject: c.subject,
    completed_at: c.completedAt.toISOString(),
    duration_minutes: c.durationMinutes,
    outcome: c.outcome,
  };
}

function serializeArtifact(a: typeof artifacts.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    subject: a.subject,
    description: a.description,
    created_by: a.createdBy,
    created_at: a.createdAt.toISOString(),
    tags: a.tags,
    preview: a.preview,
  };
}

export default async function studentsRoutes(app: FastifyInstance) {
  // GET /students/me/home — bundle unico per la homepage
  app.get('/students/me/home', { onRequest: [app.requireAuth] }, async (req) => {
    const p = req.principal!;
    if (p.role !== 'student') throw forbidden('Endpoint riservato allo studente');
    const studentId = p.sub;

    const [u] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    const [s] = await db.select().from(students).where(eq(students.userId, studentId)).limit(1);
    if (!u || !s) throw notFound('Studente non trovato');

    // sessione corrente o paused più recente
    const [currentSession] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.studentId, studentId),
          or(eq(sessions.status, 'paused'), eq(sessions.status, 'active')),
        ),
      )
      .orderBy(desc(sessions.lastTouchedAt))
      .limit(1);

    // attività visibili ora, non completate/scartate
    const now = new Date();
    const upcomingRows = await db
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
      .orderBy(activities.priority);

    const toolkitRows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.studentId, studentId))
      .orderBy(desc(artifacts.createdAt));

    const completedRows = await db
      .select()
      .from(completions)
      .where(eq(completions.studentId, studentId))
      .orderBy(desc(completions.completedAt))
      .limit(3);

    const nodeRows = await db.select().from(topicNodes).where(eq(topicNodes.studentId, studentId));
    const edgeRows = await db.select().from(topicEdges).where(eq(topicEdges.studentId, studentId));
    const constellationUpdatedAt = nodeRows.reduce<Date | null>(
      (acc, n) => (acc === null || n.updatedAt > acc ? n.updatedAt : acc),
      null,
    );

    // narrative: ultima nota del curator per questo studente
    const lastCuratorNote = await collections
      .curatorNotebook()
      .findOne({ student_id: studentId }, { sort: { written_at: -1 } });
    const narrative = lastCuratorNote?.body ?? null;

    // thread Chiara: cerchiamo il thread che contiene sia lo studente che il suo tutor
    let chiaraPreview: {
      id: string;
      last_message: {
        id: string;
        from: string;
        kind: 'student' | 'tutor';
        at: string;
        text: string;
      } | null;
    } | null = null;

    if (s.tutorId) {
      const [myThread] = await db
        .select()
        .from(threads)
        .where(
          and(
            sql`${threads.participants} @> ARRAY[${studentId}]::text[]`,
            sql`${threads.participants} @> ARRAY[${s.tutorId}]::text[]`,
          ),
        )
        .limit(1);

      if (myThread) {
        const [last] = await db
          .select()
          .from(messages)
          .where(eq(messages.threadId, myThread.id))
          .orderBy(desc(messages.at))
          .limit(1);

        chiaraPreview = {
          id: myThread.id,
          last_message: last
            ? {
                id: last.id,
                from: last.fromUser,
                kind: last.kind,
                at: last.at.toISOString(),
                text: last.text,
              }
            : null,
        };
      }
    }

    return {
      user: {
        id: u.id,
        role: u.role,
        name: u.name,
        full_name: u.fullName,
        avatar_initial: u.avatarInitial,
        grade: s.grade,
        school: s.school,
        tutor_id: s.tutorId,
      },
      current_session: currentSession ? serializeSession(currentSession) : null,
      upcoming: upcomingRows.map(serializeActivity),
      toolkit: toolkitRows.map(serializeArtifact),
      completed_recent: completedRows.map(serializeCompletion),
      constellation: {
        updated_at: constellationUpdatedAt?.toISOString() ?? null,
        nodes: nodeRows.map((n) => ({
          id: n.id,
          label: n.label,
          x: n.x,
          y: n.y,
          r: n.r,
          state: n.state,
        })),
        edges: edgeRows.map((e) => [e.nodeA, e.nodeB] as [string, string]),
        narrative,
      },
      chiara_thread_preview: chiaraPreview,
    };
  });

  const completedQuery = z.object({
    limit: z.coerce.number().int().positive().max(200).default(50),
  });

  app.get('/students/me/completed', { onRequest: [app.requireAuth] }, async (req) => {
    const p = req.principal!;
    if (p.role !== 'student') throw forbidden();
    const { limit } = completedQuery.parse(req.query ?? {});
    const rows = await db
      .select()
      .from(completions)
      .where(eq(completions.studentId, p.sub))
      .orderBy(desc(completions.completedAt))
      .limit(limit);
    return {
      items: rows.map(serializeCompletion),
      total: rows.length,
    };
  });
}

export { serializeSession, serializeActivity, serializeCompletion, serializeArtifact };
