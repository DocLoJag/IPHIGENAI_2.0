import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { attachmentsGridFS } from '../db/mongo.js';
import { attachments, students, users } from '../db/schema.js';
import { hashPassword } from '../auth/passwords.js';
import { conflict, notFound } from '../lib/errors.js';
import { id as mkId } from '../lib/ids.js';
import { seedDemo } from '../seed/run.js';

const createBody = z.object({
  role: z.enum(['student', 'tutor', 'admin']),
  username: z.string().min(3).max(32).regex(/^[a-z0-9_.-]+$/i),
  password: z.string().min(6),
  name: z.string().min(1),
  full_name: z.string().optional(),
  avatar_initial: z.string().max(2).optional(),
  grade: z.string().optional(),
  school: z.string().optional(),
  tutor_id: z.string().optional(),
});

const updateBody = z.object({
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  full_name: z.string().optional(),
  avatar_initial: z.string().max(2).optional(),
  grade: z.string().optional(),
  school: z.string().optional(),
  tutor_id: z.string().optional(),
});

const cleanupBody = z
  .object({
    days: z.number().int().min(7).max(3650).optional(),
  })
  .strict();

function serializeUser(u: typeof users.$inferSelect, s?: typeof students.$inferSelect) {
  return {
    id: u.id,
    role: u.role,
    username: u.username,
    name: u.name,
    full_name: u.fullName,
    avatar_initial: u.avatarInitial,
    created_at: u.createdAt.toISOString(),
    disabled_at: u.disabledAt?.toISOString() ?? null,
    grade: s?.grade ?? null,
    school: s?.school ?? null,
    tutor_id: s?.tutorId ?? null,
  };
}

export default async function adminRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.requireRole('admin')] };

  // POST /admin/users
  app.post('/admin/users', guard, async (req, reply) => {
    const body = createBody.parse(req.body);

    const existing = await db.select().from(users).where(eq(users.username, body.username));
    if (existing.length > 0) throw conflict('Username già in uso', 'USERNAME_TAKEN');

    const userId = mkId.user(body.role, body.username);
    const passwordHash = await hashPassword(body.password);

    const [u] = await db
      .insert(users)
      .values({
        id: userId,
        role: body.role,
        username: body.username,
        passwordHash,
        name: body.name,
        fullName: body.full_name ?? null,
        avatarInitial: body.avatar_initial ?? body.name.charAt(0).toUpperCase(),
      })
      .returning();
    if (!u) throw notFound('Inserimento utente fallito');

    let studentRow: typeof students.$inferSelect | undefined;
    if (body.role === 'student') {
      [studentRow] = await db
        .insert(students)
        .values({
          userId,
          grade: body.grade ?? null,
          school: body.school ?? null,
          tutorId: body.tutor_id ?? null,
        })
        .returning();
    }

    reply.code(201);
    return { user: serializeUser(u, studentRow) };
  });

  // GET /admin/users
  app.get('/admin/users', guard, async () => {
    const rows = await db
      .select()
      .from(users)
      .where(isNull(users.disabledAt))
      .orderBy(desc(users.createdAt));
    const studs = await db.select().from(students);
    const byUser = new Map(studs.map((s) => [s.userId, s]));
    return { users: rows.map((u) => serializeUser(u, byUser.get(u.id))) };
  });

  // PUT /admin/users/:id
  app.put<{ Params: { id: string } }>('/admin/users/:id', guard, async (req) => {
    const body = updateBody.parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u) throw notFound('Utente non trovato');

    const updates: Partial<typeof users.$inferInsert> = {};
    if (body.password) updates.passwordHash = await hashPassword(body.password);
    if (body.name) updates.name = body.name;
    if (body.full_name !== undefined) updates.fullName = body.full_name;
    if (body.avatar_initial !== undefined) updates.avatarInitial = body.avatar_initial;
    let u2: typeof users.$inferSelect = u;
    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, u.id))
        .returning();
      if (updated) u2 = updated;
    }

    let s2: typeof students.$inferSelect | undefined;
    if (u.role === 'student') {
      const sUpdates: Partial<typeof students.$inferInsert> = {};
      if (body.grade !== undefined) sUpdates.grade = body.grade;
      if (body.school !== undefined) sUpdates.school = body.school;
      if (body.tutor_id !== undefined) sUpdates.tutorId = body.tutor_id;
      if (Object.keys(sUpdates).length > 0) {
        const [updated] = await db
          .update(students)
          .set(sUpdates)
          .where(eq(students.userId, u.id))
          .returning();
        s2 = updated;
      } else {
        [s2] = await db.select().from(students).where(eq(students.userId, u.id));
      }
    }

    return { user: serializeUser(u2, s2) };
  });

  // DELETE /admin/users/:id (soft delete)
  app.delete<{ Params: { id: string } }>('/admin/users/:id', guard, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u) throw notFound('Utente non trovato');
    await db
      .update(users)
      .set({ disabledAt: new Date() })
      .where(and(eq(users.id, u.id), isNull(users.disabledAt)));
    return { ok: true };
  });

  // POST /admin/reset-demo
  // Riporta il DB (Postgres + Mongo) allo stato del seed demo iniziale.
  // Distruttivo: TRUNCATE + re-insert. Richiede ruolo admin.
  // Serve per il pilota, per rimettere la sessione di test di Luca in "paused"
  // dopo averla completata durante una demo.
  app.post('/admin/reset-demo', guard, async (req) => {
    req.log.warn({ actor: req.principal?.sub }, 'RESET demo data richiesto');
    await seedDemo();
    return { ok: true, reset_at: new Date().toISOString() };
  });

  // POST /admin/cleanup-attachments
  // Hard-delete distruttivo per gli allegati soft-deleted da almeno N giorni:
  // rimuove sia il blob GridFS sia la riga `attachments`. Pensato per essere
  // chiamato manualmente dall'admin (UI in AdminHome) — non c'è un cron
  // automatico per scelta, perché il pilota ha pochi file e preferiamo
  // chirurgia umana a un job nascosto.
  //
  // Le righe della chat AI (`ai_messages.attachment_ids[]`) possono ancora
  // riferirsi a id ormai cancellati: la replay history filtra silenziosamente
  // i missing/deleted (`loadAttachmentsByIds`), quindi il thread sopravvive
  // senza throw — semplicemente non rivedi più quel blocco.
  //
  // Threshold default 30d; floor a 7d per evitare hard-delete su soft-delete
  // recenti (l'admin che si pente entro la prima settimana ha tempo).
  app.post('/admin/cleanup-attachments', guard, async (req) => {
    const body = cleanupBody.parse(req.body ?? {});
    const days = body.days ?? 30;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const candidates = await db
      .select()
      .from(attachments)
      .where(
        and(
          isNotNull(attachments.deletedAt),
          lt(attachments.deletedAt, threshold),
        ),
      );

    let blobsDeleted = 0;
    let blobsFailed = 0;
    for (const a of candidates) {
      try {
        await attachmentsGridFS().delete(new ObjectId(a.gridfsId));
        blobsDeleted++;
      } catch (err) {
        // Best-effort: se il blob non c'è più (ObjectId stale, race con un
        // run precedente parzialmente completato) continuiamo. La riga
        // Postgres viene comunque cancellata: chi vincola? Solo `ai_messages`
        // (Mongo, dropping silently) e niente FK in Postgres su `attachments`.
        blobsFailed++;
        req.log.warn({ id: a.id, gridfsId: a.gridfsId, err: String(err) }, 'GridFS delete failed during cleanup');
      }
    }

    let rowsDeleted = 0;
    if (candidates.length > 0) {
      const ids = candidates.map((a) => a.id);
      const deleted = await db
        .delete(attachments)
        .where(inArray(attachments.id, ids))
        .returning({ id: attachments.id });
      rowsDeleted = deleted.length;
    }

    req.log.warn(
      { actor: req.principal?.sub, days, candidates: candidates.length, blobsDeleted, blobsFailed, rowsDeleted },
      'Attachment cleanup eseguito',
    );

    return {
      ok: true,
      days,
      threshold: threshold.toISOString(),
      candidates: candidates.length,
      blobs_deleted: blobsDeleted,
      blobs_failed: blobsFailed,
      rows_deleted: rowsDeleted,
    };
  });
}
