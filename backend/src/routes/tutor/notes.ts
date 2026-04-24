/*
 * Rotte sulle note private del tutor (appunti sullo studente).
 * - POST   /tutor/students/:id/notes
 * - GET    /tutor/students/:id/notes
 * - PATCH  /tutor/notes/:id
 * - DELETE /tutor/notes/:id                    (hard delete: sono appunti personali,
 *                                               non oggetti editoriali come le activities)
 */
import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/postgres.js';
import { tutorNotes } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { id as genId } from '../../lib/ids.js';
import { assertTutorOwnsNote, assertTutorOwnsStudent } from './guards.js';
import { serializeTutorNote } from './serializers.js';

const createNoteBody = z
  .object({
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

const patchNoteBody = z
  .object({
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

const notesListQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export default async function tutorNotesRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('tutor')] };

  app.post<{ Params: { id: string } }>(
    '/tutor/students/:id/notes',
    guard,
    async (req, reply) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const body = createNoteBody.parse(req.body ?? {});

      const [row] = await db
        .insert(tutorNotes)
        .values({
          id: genId.tutorNote(),
          studentId,
          tutorId,
          body: body.body,
        })
        .returning();

      if (!row) throw notFound('Creazione nota fallita');
      reply.code(201);
      return serializeTutorNote(row);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/tutor/students/:id/notes',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const studentId = req.params.id;
      await assertTutorOwnsStudent(tutorId, studentId);

      const { limit } = notesListQuery.parse(req.query ?? {});

      const rows = await db
        .select()
        .from(tutorNotes)
        .where(and(eq(tutorNotes.studentId, studentId), eq(tutorNotes.tutorId, tutorId)))
        .orderBy(desc(tutorNotes.createdAt))
        .limit(limit);

      return { items: rows.map(serializeTutorNote), total: rows.length };
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/tutor/notes/:id',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const noteId = req.params.id;
      await assertTutorOwnsNote(tutorId, noteId);

      const body = patchNoteBody.parse(req.body ?? {});

      const [row] = await db
        .update(tutorNotes)
        .set({ body: body.body, updatedAt: new Date() })
        .where(eq(tutorNotes.id, noteId))
        .returning();

      if (!row) throw notFound('Nota non trovata');
      return serializeTutorNote(row);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/tutor/notes/:id',
    guard,
    async (req) => {
      const tutorId = req.principal!.sub;
      const noteId = req.params.id;
      await assertTutorOwnsNote(tutorId, noteId);

      await db.delete(tutorNotes).where(eq(tutorNotes.id, noteId));
      return { ok: true };
    },
  );
}
