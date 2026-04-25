/*
 * Upload e download di allegati (foto compiti, PDF di esercizi, materiali).
 *
 * Storage: metadata su Postgres (`attachments`), binario su Mongo GridFS
 * (bucket `attachments`). Coerente con la decisione architetturale di tenere
 * i dati non strutturati su Mongo (curator notebook, ai messages, artifact
 * bodies). Zero nuovi servizi/credenziali.
 *
 * Endpoint:
 *   POST   /api/uploads               — multipart, ritorna { id, url, ... }
 *   GET    /api/uploads/:id           — stream binario (auth + ownership)
 *   GET    /api/uploads/:id/meta      — solo metadati (utile a UI/refresh)
 *   DELETE /api/uploads/:id           — soft-delete (binario GridFS resta)
 *
 * Auth/ownership:
 *   - chi ha caricato (ownerId) può sempre leggere e cancellare
 *   - tutor: può leggere/cancellare i file il cui `studentId` è uno dei suoi studenti
 *   - admin: può leggere/cancellare tutto
 *   - studente: oltre ai propri, può leggere file dove `studentId === self`
 *               (così il tutor può caricare un PDF "per Luca" e Luca lo vede)
 *
 * Validation:
 *   - MIME whitelisted (immagini comuni + PDF)
 *   - size cap 10 MB (rifiutato a livello multipart, niente CPU sprecata)
 *
 * Soft-delete: marca `deletedAt`. Il binario GridFS resta per consentire
 * undelete o audit; un job di cleanup futuro può rimuovere i file con
 * `deleted_at < now() - 30d` ed eliminare il GridFS file corrispondente.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { attachmentsGridFS } from '../db/mongo.js';
import { attachments, students, type AttachmentRow } from '../db/schema.js';
import { badRequest, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { id as genId } from '../lib/ids.js';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const uploadsListQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  student_id: z.string().min(1).optional(),
});

type SerializedAttachment = {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  owner_id: string;
  student_id: string | null;
  url: string;
  created_at: string;
  deleted_at: string | null;
};

function serializeAttachment(a: AttachmentRow): SerializedAttachment {
  return {
    id: a.id,
    filename: a.filename,
    mime: a.mime,
    size_bytes: a.sizeBytes,
    owner_id: a.ownerId,
    student_id: a.studentId,
    url: `/api/uploads/${a.id}`,
    created_at: a.createdAt.toISOString(),
    deleted_at: a.deletedAt ? a.deletedAt.toISOString() : null,
  };
}

// Verifica che l'utente abbia diritto di leggere/cancellare l'allegato.
// Throwa AppError (401/403/404) — il chiamante non deve gestire i codici a mano.
async function assertCanAccessAttachment(
  req: FastifyRequest,
  attachmentId: string,
  { allowDeleted }: { allowDeleted: boolean },
): Promise<AttachmentRow> {
  if (!req.principal) throw unauthorized();
  const [a] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  if (!a) throw notFound('Allegato non trovato');
  if (!allowDeleted && a.deletedAt) throw notFound('Allegato non trovato');

  const me = req.principal;
  if (me.role === 'admin') return a;
  if (a.ownerId === me.sub) return a;

  // Studente: legge gli allegati associati a sé (caricati per esempio dal tutor).
  if (me.role === 'student' && a.studentId && a.studentId === me.sub) return a;

  // Tutor: legge gli allegati il cui studentId è un proprio studente.
  if (me.role === 'tutor' && a.studentId) {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.userId, a.studentId))
      .limit(1);
    if (s && s.tutorId === me.sub) return a;
  }

  throw forbidden('Allegato non accessibile');
}

// Verifica che il `student_id` dichiarato in upload sia legittimo per
// l'utente che sta caricando. Ritorna lo studentId effettivo da salvare
// (può essere null se non passato e non derivabile).
async function resolveStudentIdForUpload(
  req: FastifyRequest,
  declaredStudentId: string | null,
): Promise<string | null> {
  if (!req.principal) throw unauthorized();
  const me = req.principal;

  if (declaredStudentId == null) {
    // Se chi carica è uno studente, l'allegato è suo.
    if (me.role === 'student') return me.sub;
    return null;
  }

  // student: può solo dichiarare se stesso.
  if (me.role === 'student') {
    if (declaredStudentId !== me.sub) {
      throw forbidden('Uno studente può caricare solo allegati per sé stesso');
    }
    return declaredStudentId;
  }

  // tutor: deve essere proprietario dello studente target.
  if (me.role === 'tutor') {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.userId, declaredStudentId))
      .limit(1);
    if (!s) throw badRequest('Studente non trovato', 'STUDENT_NOT_FOUND');
    if (s.tutorId !== me.sub) {
      throw forbidden('Studente non assegnato a questo tutor');
    }
    return declaredStudentId;
  }

  // admin: liberamente, ma deve esistere.
  if (me.role === 'admin') {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.userId, declaredStudentId))
      .limit(1);
    if (!s) throw badRequest('Studente non trovato', 'STUDENT_NOT_FOUND');
    return declaredStudentId;
  }

  throw forbidden();
}

// Stream del binario in GridFS. Resolve con { gridfsId, sizeBytes } al termine.
// Se Mongo throwa, il chiamante decide come ripulire (qui: niente da pulire,
// non abbiamo ancora scritto la riga Postgres).
function streamToGridFS(
  filename: string,
  mime: string,
  ownerId: string,
  studentId: string | null,
  source: NodeJS.ReadableStream,
): Promise<{ gridfsId: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const bucket = attachmentsGridFS();
    const upload = bucket.openUploadStream(filename, {
      contentType: mime,
      metadata: { ownerId, studentId, originalName: filename },
    });
    let sizeBytes = 0;
    source.on('data', (chunk: Buffer) => {
      sizeBytes += chunk.length;
    });
    source.on('error', reject);
    upload.on('error', reject);
    upload.on('finish', () => {
      resolve({ gridfsId: upload.id.toString(), sizeBytes });
    });
    source.pipe(upload);
  });
}

export default async function uploadsRoutes(app: FastifyInstance) {
  // ─── POST /api/uploads ───────────────────────────────────────────
  // Multipart con un solo `file` + opzionale field `student_id`.
  // I limiti sono enforced dal plugin multipart (registrato in app.ts);
  // qui ricontrolliamo `truncated` per essere sicuri.
  app.post(
    '/uploads',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      if (!req.isMultipart()) {
        throw badRequest('Richiesto multipart/form-data', 'NOT_MULTIPART');
      }

      // attachFieldsToBody=false (default): iteriamo le parts manualmente,
      // mantenendo lo streaming verso GridFS senza buffer in memoria.
      // CONVENZIONE: il client deve mettere i form fields (es. `student_id`)
      // PRIMA del file part nel multipart, perché qui processiamo le parts
      // nell'ordine in cui arrivano. È l'ordine standard di FormData del
      // browser quando si chiama `append('student_id', ...)` prima di
      // `append('file', ...)`.
      const ownerId = req.principal!.sub;

      let declaredStudentId: string | null = null;
      let filename: string | null = null;
      let mime: string | null = null;
      let gridfsId: string | null = null;
      let sizeBytes = 0;
      let fileTruncated = false;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'student_id' && typeof part.value === 'string') {
            const v = part.value.trim();
            if (v) declaredStudentId = v;
          }
          continue;
        }
        // file part
        if (part.fieldname !== 'file') {
          // Drena il file ignorato per non lasciare lo stream appeso.
          // Documentazione @fastify/multipart consiglia `await part.file.resume()` o consumo.
          part.file.resume();
          continue;
        }
        if (filename != null) {
          throw badRequest('Un solo file per richiesta', 'MULTIPLE_FILES');
        }
        const fileMime = part.mimetype || 'application/octet-stream';
        if (!ALLOWED_MIME.has(fileMime)) {
          // Drena il resto del body prima di rifiutare (altrimenti il client
          // potrebbe pensare a una connessione tagliata male).
          part.file.resume();
          throw badRequest(
            `Tipo file non consentito: ${fileMime}`,
            'MIME_NOT_ALLOWED',
          );
        }
        filename = (part.filename || 'upload').slice(0, 255);
        mime = fileMime;

        // Risolvi student_id PRIMA di iniziare a streamare in GridFS:
        // se rifiutiamo dopo metà upload abbiamo già scritto blob orfani.
        const resolvedStudent = await resolveStudentIdForUpload(req, declaredStudentId);

        const result = await streamToGridFS(
          filename,
          mime,
          ownerId,
          resolvedStudent,
          part.file,
        );
        gridfsId = result.gridfsId;
        sizeBytes = result.sizeBytes;
        fileTruncated = part.file.truncated;

        if (fileTruncated || sizeBytes > MAX_BYTES) {
          // Limite eccede: rimuovi il blob da GridFS, niente Postgres.
          await attachmentsGridFS()
            .delete(new ObjectId(gridfsId))
            .catch(() => {});
          throw badRequest(
            `File troppo grande (max ${MAX_BYTES} byte)`,
            'FILE_TOO_LARGE',
          );
        }
        declaredStudentId = resolvedStudent;
      }

      if (!filename || !mime || !gridfsId) {
        throw badRequest('Campo "file" mancante nel multipart', 'FILE_MISSING');
      }

      const [row] = await db
        .insert(attachments)
        .values({
          id: genId.attachment(),
          ownerId,
          studentId: declaredStudentId,
          filename,
          mime,
          sizeBytes,
          gridfsId,
        })
        .returning();
      if (!row) {
        await attachmentsGridFS()
          .delete(new ObjectId(gridfsId))
          .catch(() => {});
        throw new Error('Insert attachment fallita');
      }
      reply.code(201);
      return serializeAttachment(row);
    },
  );

  // ─── GET /api/uploads/:id/meta ───────────────────────────────────
  // Metadata JSON. Utile per la UI per refreshare un allegato senza
  // riscaricare il binario.
  app.get<{ Params: { id: string } }>(
    '/uploads/:id/meta',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const a = await assertCanAccessAttachment(req, req.params.id, { allowDeleted: false });
      return serializeAttachment(a);
    },
  );

  // ─── GET /api/uploads/:id ────────────────────────────────────────
  // Stream del binario. Auth + ownership obbligatorie.
  // Cache: privata, brevi: i file sono per definizione personali.
  app.get<{ Params: { id: string } }>(
    '/uploads/:id',
    { onRequest: [app.requireAuth] },
    async (req, reply: FastifyReply) => {
      const a = await assertCanAccessAttachment(req, req.params.id, { allowDeleted: false });

      reply.header('Content-Type', a.mime);
      reply.header('Content-Length', String(a.sizeBytes));
      reply.header('Cache-Control', 'private, max-age=3600');
      // inline = il browser prova a renderizzare (immagini/PDF) invece di
      // forzare il download. Filename quotato per safety.
      const safeName = a.filename.replace(/"/g, '');
      reply.header('Content-Disposition', `inline; filename="${safeName}"`);

      const stream = attachmentsGridFS().openDownloadStream(new ObjectId(a.gridfsId));
      // Errori sullo stream PRE-send ricadono nell'errorHandler globale come 500.
      // Errori in pipe vengono propagati a Fastify dal `reply.send(stream)`.
      return reply.send(stream);
    },
  );

  // ─── DELETE /api/uploads/:id ─────────────────────────────────────
  // Soft-delete. L'owner o l'admin possono cancellare. Il tutor che ha
  // accesso in lettura NON cancella file altrui (per ora).
  app.delete<{ Params: { id: string } }>(
    '/uploads/:id',
    { onRequest: [app.requireAuth] },
    async (req) => {
      if (!req.principal) throw unauthorized();
      const [a] = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, req.params.id))
        .limit(1);
      if (!a) throw notFound('Allegato non trovato');
      if (a.deletedAt) return { ok: true, already_deleted: true };

      const me = req.principal;
      if (me.role !== 'admin' && a.ownerId !== me.sub) {
        throw forbidden('Solo l\'autore può cancellare l\'allegato');
      }

      await db
        .update(attachments)
        .set({ deletedAt: new Date() })
        .where(eq(attachments.id, a.id));
      return { ok: true };
    },
  );

  // ─── GET /api/uploads ────────────────────────────────────────────
  // Lista degli allegati visibili all'utente loggato. Filtro opzionale
  // per studente. Esclude i soft-deleted. Per il pilota è una vista
  // utile sia in dev (debug) sia in futuro per una sezione "i tuoi file".
  app.get(
    '/uploads',
    { onRequest: [app.requireAuth] },
    async (req) => {
      if (!req.principal) throw unauthorized();
      const me = req.principal;
      const { limit, student_id } = uploadsListQuery.parse(req.query ?? {});

      // Filtri:
      //   - student: solo i propri (ownerId = self)
      //   - tutor: solo quelli del proprio studente (filtro `student_id` obbligatorio)
      //   - admin: tutto, eventualmente filtrato per studente
      // Tutti escludono i soft-deleted via `isNull(deletedAt)`.
      const notDeleted = isNull(attachments.deletedAt);
      let rows: AttachmentRow[];
      if (me.role === 'student') {
        rows = await db
          .select()
          .from(attachments)
          .where(and(eq(attachments.ownerId, me.sub), notDeleted))
          .orderBy(desc(attachments.createdAt))
          .limit(limit);
      } else if (me.role === 'tutor') {
        if (!student_id) {
          return { items: [], total: 0 };
        }
        const [s] = await db
          .select()
          .from(students)
          .where(eq(students.userId, student_id))
          .limit(1);
        if (!s || s.tutorId !== me.sub) throw forbidden();
        rows = await db
          .select()
          .from(attachments)
          .where(and(eq(attachments.studentId, student_id), notDeleted))
          .orderBy(desc(attachments.createdAt))
          .limit(limit);
      } else {
        rows = student_id
          ? await db
              .select()
              .from(attachments)
              .where(and(eq(attachments.studentId, student_id), notDeleted))
              .orderBy(desc(attachments.createdAt))
              .limit(limit)
          : await db
              .select()
              .from(attachments)
              .where(notDeleted)
              .orderBy(desc(attachments.createdAt))
              .limit(limit);
      }

      return { items: rows.map(serializeAttachment), total: rows.length };
    },
  );
}
