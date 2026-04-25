import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import { anthropic, models } from './anthropic.js';
import { tutorSystemPrompt } from './system-prompts.js';
import { collections, type AiMessageDoc } from '../db/mongo.js';
import {
  attachmentToContentBlock,
  gridfsToBase64,
  loadAttachmentsByIds,
  loadAttachmentsForStudent,
  type AnthropicContentBlock,
} from './attachment-blocks.js';
import { serializeAttachment } from '../routes/serializers.js';

type TutorTurnInput = {
  threadId: string;
  studentId: string;
  studentName: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  userText: string;
  // §8.6-st3: id allegati Postgres da inviare con il turno corrente. Verranno
  // validati (`loadAttachmentsForStudent`) e convertiti in image/document
  // content block. Persisititi sul doc Mongo per la replay nei turni successivi.
  attachmentIds?: string[];
};

type SerializedMessage = {
  id: string;
  from: 'student' | 'ai';
  at: string;
  text: string;
  // Presente solo se il messaggio aveva allegati. Forma serializzata coerente
  // con `routes/uploads.ts` (campo `url` relativo `/api/uploads/:id`).
  attachments?: ReturnType<typeof serializeAttachment>[];
};

// Forma "permissiva" del messaggio Anthropic — include `document` block che
// nell'SDK 0.32 vive nel namespace `beta`, ma è accettato a runtime dalla
// rotta `messages.create` standard. Cast a `MessageParam[]` al call site.
type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

export type PreparedTurn = {
  threadId: string;
  studentDoc: AiMessageDoc;
  aiSeq: number;
  system: string;
  anthropicMessages: AnthropicMessage[];
};

const MAX_HISTORY_MESSAGES = 40;

// Carica history, persiste subito il messaggio studente, costruisce system + messages
// per la chiamata Anthropic. Usata sia dalla rotta sync (runTutorTurn) sia dalla
// rotta SSE (/message/stream): in entrambi i casi vogliamo che il messaggio studente
// sia salvato prima della chiamata al modello, così la coppia user/AI è atomica
// dal punto di vista di Mongo (l'AI viene aggiunto a fine streaming/completamento).
//
// §8.6-st3 — gestione allegati:
//   1) Validiamo subito gli allegati del turno corrente (`attachmentIds`) con
//      `loadAttachmentsForStudent`: ownership + non-soft-deleted. Se uno dei
//      file non è autorizzato/esiste, throwiamo PRIMA di toccare Mongo.
//   2) Persistiamo gli ID sul doc studente (campo `attachment_ids`).
//   3) Per la replay verso Anthropic, ricarichiamo gli allegati di tutti i
//      turni nella history (uniti in un'unica query) e li convertiamo in
//      content block image/document. Storica scelta di costo: ogni turno
//      rileggiamo i blob — accettabile per il pilota (single student, ~10 turni).
export async function prepareTutorTurn(input: TutorTurnInput): Promise<PreparedTurn> {
  const msgCol = collections.aiMessages();

  // 1) Valida allegati del turno corrente (può throware) — fatto PRIMA di
  // qualsiasi insert su Mongo per evitare doc orfani.
  const turnAttachmentIds = (input.attachmentIds ?? []).filter((s) => s && s.trim().length > 0);
  const turnAttachments = turnAttachmentIds.length
    ? await loadAttachmentsForStudent(turnAttachmentIds, input.studentId)
    : [];

  const history = await msgCol
    .find({ thread_id: input.threadId })
    .sort({ seq: 1 })
    .toArray();

  const userSeq = (history[history.length - 1]?.seq ?? 0) + 1;

  const studentDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: userSeq,
    from: 'student',
    at: new Date(),
    text: input.userText,
    ...(turnAttachmentIds.length ? { attachment_ids: turnAttachmentIds } : {}),
  };
  await msgCol.insertOne(studentDoc);

  const system = tutorSystemPrompt({
    studentName: input.studentName,
    grade: input.grade,
    subject: input.subject,
    topic: input.topic,
  });

  const trimmed = [...history, studentDoc].slice(-MAX_HISTORY_MESSAGES);

  // 2) Carica metadata di TUTTI gli allegati referenziati nella history trimmata.
  // Una sola query Postgres, una sola read-per-blob da GridFS.
  const allHistoryIds = new Set<string>();
  for (const m of trimmed) {
    for (const id of m.attachment_ids ?? []) allHistoryIds.add(id);
  }
  // Pre-carico i metadata. Per gli ID del turno corrente li abbiamo già: li
  // mettiamo nella mappa per evitare una doppia query.
  const metadataMap = await loadAttachmentsByIds([...allHistoryIds]);
  for (const a of turnAttachments) {
    metadataMap.set(a.id, a);
  }

  // 3) Scarico in base64 (cache locale alla chiamata) ogni blob necessario.
  const base64Cache = new Map<string, string>();
  for (const id of allHistoryIds) {
    const a = metadataMap.get(id);
    if (!a) continue; // soft-deleted nel frattempo: lo droppiamo dalla replay
    base64Cache.set(id, await gridfsToBase64(a.gridfsId));
  }

  const anthropicMessages: AnthropicMessage[] = trimmed.map((m) => {
    const ids = m.attachment_ids ?? [];
    if (m.from !== 'student' || ids.length === 0) {
      return {
        role: m.from === 'student' ? 'user' : 'assistant',
        content: m.text,
      };
    }
    const blocks: AnthropicContentBlock[] = [];
    for (const id of ids) {
      const a = metadataMap.get(id);
      const b64 = base64Cache.get(id);
      if (!a || !b64) continue;
      blocks.push(attachmentToContentBlock(a, b64));
    }
    if (m.text && m.text.trim().length > 0) {
      blocks.push({ type: 'text', text: m.text });
    }
    // Difensivo: Anthropic richiede content non-vuoto. Se per qualunque motivo
    // (tutti gli allegati cancellati, testo vuoto) ci ritroviamo con 0 blocchi,
    // forniamo un placeholder testuale.
    if (blocks.length === 0) {
      return { role: 'user' as const, content: m.text || '(allegato non più disponibile)' };
    }
    return { role: 'user' as const, content: blocks };
  });

  return {
    threadId: input.threadId,
    studentDoc,
    aiSeq: userSeq + 1,
    system,
    anthropicMessages,
  };
}

export type FinalizeTurnInput = {
  threadId: string;
  seq: number;
  text: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
};

// Persiste il messaggio AI finale su Mongo. Chiamata sia alla fine di runTutorTurn
// (response completa) sia alla chiusura dello streaming (testo accumulato).
export async function finalizeTutorTurn(input: FinalizeTurnInput): Promise<AiMessageDoc> {
  const aiDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: input.seq,
    from: 'ai',
    at: new Date(),
    text: input.text,
    model: input.model,
    tokens_in: input.tokens_in,
    tokens_out: input.tokens_out,
  };
  await collections.aiMessages().insertOne(aiDoc);
  return aiDoc;
}

// Helper di serializzazione: dato un AiMessageDoc + mappa metadata allegati,
// produce il SerializedMessage che esponiamo al client (con la lista
// `attachments` in forma serializzata se presenti).
export function serializeAiMessage(
  m: AiMessageDoc,
  threadId: string,
  attachmentsById: Map<string, ReturnType<typeof serializeAttachment>>,
): SerializedMessage {
  const ids = m.attachment_ids ?? [];
  const atts = ids
    .map((id) => attachmentsById.get(id))
    .filter((x): x is ReturnType<typeof serializeAttachment> => Boolean(x));
  const at = m.at instanceof Date ? m.at : new Date(m.at);
  const out: SerializedMessage = {
    id: `${threadId}-${m.seq}`,
    from: m.from,
    at: at.toISOString(),
    text: m.text,
  };
  if (atts.length) out.attachments = atts;
  return out;
}

export async function runTutorTurn(input: TutorTurnInput): Promise<{
  messages: SerializedMessage[];
}> {
  const prepared = await prepareTutorTurn(input);

  const response = await anthropic().messages.create({
    model: models.tutor,
    max_tokens: 1024,
    system: prepared.system,
    // Cast: `document` block manca dai tipi SDK 0.32 (vive in `beta`), ma
    // l'API standard lo accetta a runtime per Sonnet 4.5+.
    messages: prepared.anthropicMessages as unknown as MessageParam[],
  });

  const replyText =
    response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim() || '…';

  const aiDoc = await finalizeTutorTurn({
    threadId: prepared.threadId,
    seq: prepared.aiSeq,
    text: replyText,
    model: response.model,
    tokens_in: response.usage?.input_tokens,
    tokens_out: response.usage?.output_tokens,
  });

  // Serializza: il client riceve i due messaggi con eventuali `attachments`
  // del turno studente (utile per la rotta sync; nello streaming la lista
  // completa viene ricostruita sul client incrementalmente).
  const studentAttachments = await loadAttachmentsByIds(
    prepared.studentDoc.attachment_ids ?? [],
  );
  const serializedById = new Map(
    [...studentAttachments.values()].map((a) => [a.id, serializeAttachment(a)]),
  );

  return {
    messages: [
      serializeAiMessage(prepared.studentDoc, prepared.threadId, serializedById),
      serializeAiMessage(aiDoc, prepared.threadId, new Map()),
    ],
  };
}
