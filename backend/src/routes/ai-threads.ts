import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { aiThreads, sessions, students } from '../db/schema.js';
import { collections } from '../db/mongo.js';
import { forbidden, notFound } from '../lib/errors.js';
import { id as mkId } from '../lib/ids.js';
import { runTutorTurn, startTutorStream } from '../services/tutor-agent.js';

export default async function aiThreadsRoutes(app: FastifyInstance) {
  // GET /ai/threads/current
  app.get('/ai/threads/current', { onRequest: [app.requireAuth] }, async (req) => {
    const p = req.principal!;
    if (p.role !== 'student') throw forbidden();

    const studentId = p.sub;

    // thread aperto più recente, o ne creiamo uno
    let [thread] = await db
      .select()
      .from(aiThreads)
      .where(and(eq(aiThreads.studentId, studentId), isNull(aiThreads.closedAt)))
      .orderBy(desc(aiThreads.openedAt))
      .limit(1);

    if (!thread) {
      // deriviamo subject/topic dalla sessione corrente, se c'è
      const [s] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.studentId, studentId))
        .orderBy(desc(sessions.lastTouchedAt))
        .limit(1);
      const newId = mkId.aiThread();
      await db.insert(aiThreads).values({
        id: newId,
        studentId,
        subject: s?.subject ?? null,
        topic: s?.topic ?? null,
      });
      [thread] = await db.select().from(aiThreads).where(eq(aiThreads.id, newId)).limit(1);
    }

    if (!thread) throw notFound('Thread AI non disponibile');

    const msgs = await collections
      .aiMessages()
      .find({ thread_id: thread.id })
      .sort({ seq: 1 })
      .toArray();

    return {
      id: thread.id,
      student_id: thread.studentId,
      subject: thread.subject,
      topic: thread.topic,
      opened_at: thread.openedAt.toISOString(),
      messages: msgs.map((m, i) => ({
        id: `${thread!.id}-${m.seq ?? i}`,
        from: m.from,
        at: (m.at instanceof Date ? m.at : new Date(m.at)).toISOString(),
        text: m.text,
      })),
    };
  });

  // POST /ai/threads/:id/message
  const msgBody = z.object({ text: z.string().min(1).max(10_000) });

  app.post<{ Params: { id: string }; Body: { text: string } }>(
    '/ai/threads/:id/message',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const p = req.principal!;
      if (p.role !== 'student') throw forbidden();
      const body = msgBody.parse(req.body);

      const [thread] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, req.params.id))
        .limit(1);
      if (!thread) throw notFound('Thread non trovato');
      if (thread.studentId !== p.sub) throw forbidden();

      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.userId, p.sub))
        .limit(1);

      const result = await runTutorTurn({
        threadId: thread.id,
        studentId: p.sub,
        studentName: p.username,
        subject: thread.subject,
        topic: thread.topic,
        grade: student?.grade ?? null,
        userText: body.text,
      });

      return { messages: result.messages };
    },
  );

  // POST /ai/threads/:id/stream — versione SSE: lo stesso turno del tutor in streaming.
  // Eventi inviati al client (formato `event: <name>\ndata: <json-line>\n\n`):
  //   - `student`  → { id, from:'student', at, text } (messaggio studente persistito)
  //   - `delta`    → { text } (chunk di testo dell'AI)
  //   - `done`     → { id, from:'ai', at, text } (messaggio AI finale persistito)
  //   - `error`    → { message }
  // Heartbeat: commento `: ping\n\n` ogni ~15s per evitare buffer/timeout intermedi.
  app.post<{ Params: { id: string }; Body: { text: string } }>(
    '/ai/threads/:id/stream',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const p = req.principal!;
      if (p.role !== 'student') throw forbidden();
      const body = msgBody.parse(req.body);

      const [thread] = await db
        .select()
        .from(aiThreads)
        .where(eq(aiThreads.id, req.params.id))
        .limit(1);
      if (!thread) throw notFound('Thread non trovato');
      if (thread.studentId !== p.sub) throw forbidden();

      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.userId, p.sub))
        .limit(1);

      // Da qui in poi prendiamo noi il controllo della response: niente serializzazione JSON automatica.
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Disabilita il buffering di reverse-proxy (nginx/Railway) per i chunk in-flight.
        'X-Accel-Buffering': 'no',
      });

      const send = (event: string, data: unknown): void => {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const heartbeat = setInterval(() => {
        if (!raw.writableEnded) raw.write(`: ping\n\n`);
      }, 15_000);

      let aborted = false;
      let streamCtl: { abort: () => void } | null = null;
      const onClientClose = (): void => {
        aborted = true;
        if (streamCtl) streamCtl.abort();
        clearInterval(heartbeat);
      };
      req.raw.on('close', onClientClose);

      try {
        const ctx = await startTutorStream({
          threadId: thread.id,
          studentId: p.sub,
          studentName: p.username,
          subject: thread.subject,
          topic: thread.topic,
          grade: student?.grade ?? null,
          userText: body.text,
        });
        streamCtl = ctx.stream.controller;

        // Eco immediata del messaggio studente persistito (id stabile per il client).
        send('student', ctx.studentMsg);

        ctx.stream.on('text', (delta) => {
          if (!aborted) send('delta', { text: delta });
        });

        const aiMsg = await ctx.finalize();
        if (!aborted) {
          send('done', aiMsg);
        }
      } catch (err) {
        req.log.error({ err }, 'tutor stream failure');
        const message = err instanceof Error ? err.message : 'Errore interno';
        if (!raw.writableEnded) {
          send('error', { message });
        }
      } finally {
        clearInterval(heartbeat);
        req.raw.off('close', onClientClose);
        if (!raw.writableEnded) raw.end();
      }
    },
  );
}
