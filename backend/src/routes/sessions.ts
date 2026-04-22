import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { exerciseAttempts, exercises, sessions } from '../db/schema/index.js';
import { forbidden, notFound } from '../lib/errors.js';
import { serializeSession } from './students.js';
import { enqueueCuratorJob } from '../queues/curator.js';

const answerBody = z.object({
  exercise_id: z.string().min(1),
  choice_id: z.string().min(1),
});

export default async function sessionRoutes(app: FastifyInstance) {
  // GET /sessions/:id
  app.get<{ Params: { id: string } }>(
    '/sessions/:id',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      const [s] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
      if (!s) throw notFound('Sessione non trovata');
      if (p.role === 'student' && s.studentId !== p.sub) throw forbidden();

      let current: typeof exercises.$inferSelect | undefined;
      if (s.nextExerciseId) {
        [current] = await db
          .select()
          .from(exercises)
          .where(eq(exercises.id, s.nextExerciseId))
          .limit(1);
      }

      return {
        session: serializeSession(s),
        current_exercise: current
          ? {
              id: current.id,
              session_id: current.sessionId,
              index: current.idx,
              of: current.ofTotal,
              subject: current.subject,
              topic: current.topic,
              prompt: current.prompt,
              formula: current.formula,
              choices: current.choices,
              hint: current.hint,
              // correct_choice_id NON viene restituito allo studente
              ...(p.role !== 'student' ? { correct_choice_id: current.correctChoiceId } : {}),
            }
          : null,
      };
    },
  );

  // POST /sessions/:id/answer
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/answer',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      if (p.role !== 'student') throw forbidden();
      const body = answerBody.parse(req.body);

      const [s] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
      if (!s) throw notFound('Sessione non trovata');
      if (s.studentId !== p.sub) throw forbidden();

      const [ex] = await db
        .select()
        .from(exercises)
        .where(and(eq(exercises.id, body.exercise_id), eq(exercises.sessionId, s.id)))
        .limit(1);
      if (!ex) throw notFound('Esercizio non trovato');

      const correct = ex.correctChoiceId === body.choice_id;
      const feedback = correct
        ? 'Esatto. Con a negativo la parabola è rivolta in basso — partiamo da qui.'
        : 'Non ancora. Guarda il segno di a prima di tutto.';

      await db.insert(exerciseAttempts).values({
        exerciseId: ex.id,
        studentId: p.sub,
        choiceId: body.choice_id,
        correct,
        feedbackText: feedback,
      });

      // esercizio successivo: quello con idx + 1 nella stessa sessione, se esiste
      const [nextEx] = await db
        .select()
        .from(exercises)
        .where(and(eq(exercises.sessionId, s.id), eq(exercises.idx, ex.idx + 1)))
        .limit(1);

      const nextId = nextEx?.id ?? null;

      const newCompletedCount = correct ? s.completedCount + 1 : s.completedCount;
      const becomingClosed = !nextId;

      await db
        .update(sessions)
        .set({
          completedCount: newCompletedCount,
          lastTouchedAt: new Date(),
          nextExerciseId: nextId,
          status: becomingClosed ? 'closed' : s.status,
          closedAt: becomingClosed ? new Date() : s.closedAt,
        })
        .where(eq(sessions.id, s.id));

      if (becomingClosed) {
        await enqueueCuratorJob({ sessionId: s.id });
      }

      return {
        correct,
        feedback,
        hint: ex.hint,
        next_exercise_id: nextId,
      };
    },
  );

  // POST /sessions/:id/pause
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/pause',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      if (p.role !== 'student') throw forbidden();
      const [s] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
      if (!s) throw notFound('Sessione non trovata');
      if (s.studentId !== p.sub) throw forbidden();
      await db
        .update(sessions)
        .set({ status: 'paused', lastTouchedAt: new Date() })
        .where(eq(sessions.id, s.id));
      return { ok: true };
    },
  );
}
