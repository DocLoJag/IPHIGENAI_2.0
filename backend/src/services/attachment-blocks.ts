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
 * Cache LRU del base64 (process-local): la replay dell'history rilegge ogni
 * allegato ad ogni turno; senza cache, una chat con 5 immagini da 1 MB
 * costava 5 round-trip a Mongo + 5 base64 encoding per OGNI messaggio nuovo
 * dello studente. La cache tiene gli ultimi N blob letti, fino a un cap
 * di byte totale; eviction LRU per `lastAccess`. È esplicitamente
 * process-local (no Redis), perché (a) il pilota gira con 1 replica API
 * e (b) GridFS+base64 è già abbastanza veloce in caso di cache miss.
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

// Cache LRU del base64. La chiave è il `gridfsId` (univoco per blob);
// `bytes` è la length della stringa base64 (≈ originale × 4/3, basta per
// dimensionare gli evict). `lastAccess` è aggiornato sia su set che su
// get. Evizione greedy quando si supera UNA delle due soglie.
type CacheEntry = { data: string; bytes: number; lastAccess: number };
const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 50;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
let cacheStats = { hits: 0, misses: 0 };

function totalCacheBytes(): number {
  let total = 0;
  for (const e of cache.values()) total += e.bytes;
  return total;
}

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES && totalCacheBytes() <= MAX_TOTAL_BYTES) return;
  // Ordino per lastAccess crescente; tolgo finché rientriamo in entrambe le soglie.
  const sorted = Array.from(cache.entries()).sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess,
  );
  for (const [k] of sorted) {
    cache.delete(k);
    if (cache.size <= MAX_ENTRIES && totalCacheBytes() <= MAX_TOTAL_BYTES) break;
  }
}

// Esposto per i test e per essere chiamato dal cleanup admin quando
// un blob viene fisicamente eliminato (così evitiamo di servire dalla
// cache una stringa che riferisce a un GridFS id non più esistente).
export function invalidateAttachmentCache(gridfsIds?: string[]): void {
  if (!gridfsIds) {
    cache.clear();
    return;
  }
  for (const id of gridfsIds) cache.delete(id);
}

// Esposto per debug/logging: utile a confermare che la cache funzioni
// quando guardiamo i log di una chat con replay history lunga.
export function attachmentCacheStats(): { hits: number; misses: number; entries: number; bytes: number } {
  return { ...cacheStats, entries: cache.size, bytes: totalCacheBytes() };
}

export async function gridfsToBase64(gridfsId: string): Promise<string> {
  const hit = cache.get(gridfsId);
  if (hit) {
    hit.lastAccess = Date.now();
    cacheStats.hits++;
    return hit.data;
  }
  cacheStats.misses++;
  const stream = attachmentsGridFS().openDownloadStream(new ObjectId(gridfsId));
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks).toString('base64');
  cache.set(gridfsId, { data, bytes: data.length, lastAccess: Date.now() });
  evictIfNeeded();
  return data;
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

