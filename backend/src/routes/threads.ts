import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { messages, threads, users } from '../db/schema.js';
import { forbidden, notFound } from '../lib/errors.js';
import { id as mkId } from '../lib/ids.js';

export default async function humanThreadsRoutes(app: FastifyInstance) {
  // GET /threads/:id
  app.get<{ Params: { id: string } }>(
    '/threads/:id',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      const [t] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
      if (!t) throw notFound('Thread non trovato');
      if (!t.participants.includes(p.sub) && p.role !== 'admin') throw forbidden();

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, t.id))
        .orderBy(messages.at);

      return {
        id: t.id,
        participants: t.participants,
        messages: msgs.map((m) => ({
          id: m.id,
          from: m.fromUser,
          kind: m.kind,
          at: m.at.toISOString(),
          text: m.text,
          read_at: m.readAt?.toISOString() ?? null,
        })),
      };
    },
  );

  // POST /threads/:id/message
  const msgBody = z.object({ text: z.string().min(1).max(5_000) });

  app.post<{ Params: { id: string }; Body: { text: string } }>(
    '/threads/:id/message',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      const body = msgBody.parse(req.body);
      const [t] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
      if (!t) throw notFound('Thread non trovato');
      if (!t.participants.includes(p.sub) && p.role !== 'admin') throw forbidden();

      const [u] = await db.select().from(users).where(eq(users.id, p.sub)).limit(1);
      if (!u) throw notFound();

      const kind: 'student' | 'tutor' = u.role === 'tutor' ? 'tutor' : 'student';
      const row = {
        id: mkId.message(),
        threadId: t.id,
        fromUser: p.sub,
        kind,
        text: body.text,
      };
      await db.insert(messages).values(row);
      const now = new Date();
      return {
        message: {
          id: row.id,
          from: row.fromUser,
          kind: row.kind,
          at: now.toISOString(),
          text: row.text,
        },
      };
    },
  );
}
