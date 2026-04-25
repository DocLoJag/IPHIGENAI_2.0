import type { FastifyInstance } from 'fastify';
import { Readable } from 'node:stream';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { aiThreads, sessions, students } from '../db/schema.js';
import { collections } from '../db/mongo.js';
import { forbidden, notFound } from '../lib/errors.js';
import { id as mkId } from '../lib/ids.js';
import {
  finalizeTutorTurn,
  prepareTutorTurn,
  runTutorTurn,
} from '../services/tutor-agent.js';
import { anthropic, models } from '../services/anthropic.js';

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

  const msgBody = z.object({ text: z.string().min(1).max(10_000) });

  // POST /ai/threads/:id/message — risposta sincrona (fallback per il client
  // se SSE non è disponibile o se serve un caller server-to-server).
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

  // POST /ai/threads/:id/message/stream — risposta in text/event-stream con i
  // delta del modello. Manteniamo il POST sync sopra come fallback.
  //
  // Eventi:
  //   meta  → { student: <SerializedMessage>, ai: { id, from, at } }
  //           emesso subito dopo aver salvato il messaggio studente; dà al
  //           client gli ID definitivi così può rimpiazzare l'optimistic e
  //           preparare il placeholder per l'AI.
  //   delta → { text: <chunk> }
  //           ogni text_delta ricevuto da Anthropic, accodato dal client al
  //           placeholder AI per costruire la risposta visibile.
  //   done  → { message: <SerializedMessage> }
  //           il messaggio AI finale persistito su Mongo (id stabile, at, text).
  //   error → { code, message }
  //           emesso dentro lo stream se qualcosa va storto DOPO l'apertura.
  //           Errori prima dell'apertura (auth/ownership/zod) ricadono nel
  //           setErrorHandler globale come per qualsiasi rotta JSON.
  app.post<{ Params: { id: string }; Body: { text: string } }>(
    '/ai/threads/:id/message/stream',
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

      const threadCtx = thread;
      const studentName = p.username;
      const studentId = p.sub;
      const grade = student?.grade ?? null;

      const sseEvent = (event: string, data: unknown): string =>
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

      async function* generate(): AsyncGenerator<string, void, void> {
        try {
          const prepared = await prepareTutorTurn({
            threadId: threadCtx.id,
            studentId,
            studentName,
            subject: threadCtx.subject,
            topic: threadCtx.topic,
            grade,
            userText: body.text,
          });

          const aiPlaceholderId = `${prepared.threadId}-${prepared.aiSeq}`;
          const aiStartedAt = new Date().toISOString();

          yield sseEvent('meta', {
            student: {
              id: `${prepared.threadId}-${prepared.studentDoc.seq}`,
              from: 'student' as const,
              at: prepared.studentDoc.at.toISOString(),
              text: prepared.studentDoc.text,
            },
            ai: {
              id: aiPlaceholderId,
              from: 'ai' as const,
              at: aiStartedAt,
            },
          });

          let accumulated = '';
          const stream = anthropic().messages.stream({
            model: models.tutor,
            max_tokens: 1024,
            system: prepared.system,
            messages: prepared.anthropicMessages,
          });

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const chunk = event.delta.text;
              accumulated += chunk;
              yield sseEvent('delta', { text: chunk });
            }
          }

          const final = await stream.finalMessage();

          const finalText = accumulated.trim() || '…';
          const aiDoc = await finalizeTutorTurn({
            threadId: prepared.threadId,
            seq: prepared.aiSeq,
            text: finalText,
            model: final.model,
            tokens_in: final.usage?.input_tokens,
            tokens_out: final.usage?.output_tokens,
          });

          yield sseEvent('done', {
            message: {
              id: `${prepared.threadId}-${aiDoc.seq}`,
              from: 'ai' as const,
              at: aiDoc.at.toISOString(),
              text: aiDoc.text,
            },
          });
        } catch (err) {
          req.log.error({ err }, 'tutor stream error');
          const message =
            err instanceof Error ? err.message : 'Errore durante lo streaming';
          yield sseEvent('error', { code: 'STREAM_ERROR', message });
        }
      }

      // Header SSE espliciti. `reply.send(stream)` di Fastify 5 fa pipe sullo
      // stream Readable: i chunk fluiscono al client via Transfer-Encoding:
      // chunked. CORS/cookie sono già gestiti dai plugin upstream perché
      // restituiamo `reply` (no hijack del raw socket).
      reply.header('Content-Type', 'text/event-stream; charset=utf-8');
      reply.header('Cache-Control', 'no-cache, no-transform');
      reply.header('Connection', 'keep-alive');
      // Disabilita il buffering di proxy tipo nginx: necessario per vedere
      // i chunk al volo. Railway non bufferizza ma è una garanzia in più.
      reply.header('X-Accel-Buffering', 'no');

      return reply.send(Readable.from(generate()));
    },
  );
}
