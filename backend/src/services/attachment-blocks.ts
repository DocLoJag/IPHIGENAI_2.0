/*
 * §8.6-st3 — conversione di allegati Postgres + GridFS in content blocks
 * Anthropic (`image` per le immagini, `document` per i PDF, base64 inline).
 *
 * Pipeline:
 *   1) `loadAttachmentsForStudent(ids, studentId)` carica le righe Postgres
 *      per gli ID richiesti e applica gli stessi guard di
 *      `assertCanAccessAttachment` (ownerId === studentId OR studentId === self),
 *      con lo stesso comportamento sui soft-deleted (404). Throwa AppError.
 *   2) `gridfsToBase64(gridfsId)` scarica il binario in memoria e ritorna
 *      la stringa base64. Niente streaming: per immagini/PDF da pochi MB è
 *      sufficiente e ci permette di passare il blob ad Anthropic in un colpo.
 *   3) `attachmentToContentBlock(att, base64)` crea il blocco corretto:
 *      - `image/{png,jpeg,webp,gif}` → `{ type:'image', source:{ type:'base64', media_type, data } }`
 *      - `application/pdf` → `{ type:'document', source:{ type:'base64', media_type:'application/pdf', data } }`
 *
 * Uso: chiamato da `services/tutor-agent.ts` per popolare l'array
 * `messages[*].content` di Anthropic con i blocchi del messaggio studente.
 *
 * Nota di costo: la replay dell'history rilegge ogni allegato ad ogni turno.
 * Per il pilota (singolo studente, ~10 turni a sessione, ~3 MB di immagine
 * media) è accettabile. Una cache LRU è il prossimo passo se i thread
 * diventano lunghi.
 */
import { ObjectId } from 'mongodb';
import { inArray } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { attachmentsGridFS } from '../db/mongo.js';
import { attachments, type AttachmentRow } from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: ImageMediaType; data: string };
    }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    };

const IMAGE_MIMES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// Carica le righe `attachments` per gli ID richiesti e verifica che lo
// studente specificato possa leggerle. Le righe sono restituite nello
// stesso ordine degli ID (utile per ricostruire l'ordine dei blocchi).
export async function loadAttachmentsForStudent(
  ids: string[],
  studentId: string,
): Promise<AttachmentRow[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.id, unique));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: AttachmentRow[] = [];
  for (const id of ids) {
    const a = byId.get(id);
    if (!a) throw notFound(`Allegato non trovato: ${id}`);
    if (a.deletedAt) throw notFound(`Allegato non trovato: ${id}`);
    if (a.ownerId !== studentId && a.studentId !== studentId) {
      throw forbidden('Allegato non accessibile');
    }
    ordered.push(a);
  }
  return ordered;
}

// Variante senza guard: dato un set di ID già autorizzati (es. ricavati da
// history Mongo, non passati direttamente dal client), li carica in blocco
// e ritorna la mappa per ID. I soft-deleted sono filtrati silenziosamente
// (la replay dell'history non deve fallire perché il file è stato cancellato
// nel frattempo: per quel turno omettiamo il blocco).
export async function loadAttachmentsByIds(ids: string[]): Promise<Map<string, AttachmentRow>> {
  if (!ids.length) return new Map();
  const unique = [...new Set(ids)];
  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.id, unique));
  const m = new Map<string, AttachmentRow>();
  for (const r of rows) {
    if (r.deletedAt) continue;
    m.set(r.id, r);
  }
  return m;
}

export async function gridfsToBase64(gridfsId: string): Promise<string> {
  const stream = attachmentsGridFS().openDownloadStream(new ObjectId(gridfsId));
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('base64');
}

export function attachmentToContentBlock(
  att: AttachmentRow,
  base64: string,
): AnthropicContentBlock {
  if (IMAGE_MIMES.has(att.mime)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: att.mime as ImageMediaType, data: base64 },
    };
  }
  if (att.mime === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  }
  // Difensivo: il filtro a monte (ALLOWED_MIME in routes/uploads.ts) dovrebbe
  // averlo già escluso. Throwa per non passare un block malformato ad Anthropic.
  throw badRequest(`Tipo file non supportato in chat AI: ${att.mime}`, 'MIME_NOT_SUPPORTED_AI');
}

// Helper di convenienza per i caller (tutor-agent): dato un AttachmentRow,
// scarica il binario e produce il content block. Restituisce null se il file
// è stato cancellato medio tempo (defensive: in pratica i caller filtrano già).
export async function buildContentBlockForAttachment(
  att: AttachmentRow | undefined,
): Promise<AnthropicContentBlock | null> {
  if (!att || att.deletedAt) return null;
  const b64 = await gridfsToBase64(att.gridfsId);
  return attachmentToContentBlock(att, b64);
}

