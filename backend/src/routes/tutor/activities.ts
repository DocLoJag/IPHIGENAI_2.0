/*
 * Rotte CRUD sulle activities del tutor.
 * - POST   /tutor/students/:id/activities
 * - PATCH  /tutor/activities/:id
 * - DELETE /tutor/activities/:id               (soft-delete via dismissed_at)
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/postgres.js';
import { activities } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { id as genId } from '../../lib/ids.js';
import {
  activityKindSchema,
  assertSessionBelongsToStudent,
  assertTutorOwnsActivity,
  assertTutorOwnsStudent,
} from './guards.js';
import { serializeTutorActivity } from './serializers.js';

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

export default async function tutorActivitiesRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('tutor')] };

  app.post<{ Params: { id: string } }>(
    '/tutor/students/:id/activities',
    guard,
    async (req, reply) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const body = createActivityBody.parse(req.body ?? {});

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

  app.patch<{ Params: { id: string } }>(
    '/tutor/activities/:id',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const activityId = req.params.id;
      const current = await assertTutorOwnsActivity(tutorId, activityId);

      const body = patchActivityBody.parse(req.body ?? {});

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
