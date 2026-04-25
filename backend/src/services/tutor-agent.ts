import { anthropic, models } from './anthropic.js';
import { tutorSystemPrompt } from './system-prompts.js';
import { collections, type AiMessageDoc } from '../db/mongo.js';

type TutorTurnInput = {
  threadId: string;
  studentId: string;
  studentName: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  userText: string;
};

type SerializedMessage = {
  id: string;
  from: 'student' | 'ai';
  at: string;
  text: string;
};

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
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
export async function prepareTutorTurn(input: TutorTurnInput): Promise<PreparedTurn> {
  const msgCol = collections.aiMessages();

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
  };
  await msgCol.insertOne(studentDoc);

  const system = tutorSystemPrompt({
    studentName: input.studentName,
    grade: input.grade,
    subject: input.subject,
    topic: input.topic,
  });

  const trimmed = [...history, studentDoc].slice(-MAX_HISTORY_MESSAGES);
  const anthropicMessages: AnthropicMessage[] = trimmed.map((m) => ({
    role: m.from === 'student' ? 'user' : 'assistant',
    content: m.text,
  }));

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

export async function runTutorTurn(input: TutorTurnInput): Promise<{
  messages: SerializedMessage[];
}> {
  const prepared = await prepareTutorTurn(input);

  const response = await anthropic().messages.create({
    model: models.tutor,
    max_tokens: 1024,
    system: prepared.system,
    messages: prepared.anthropicMessages,
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

  return {
    messages: [
      {
        id: `${prepared.threadId}-${prepared.studentDoc.seq}`,
        from: 'student',
        at: prepared.studentDoc.at.toISOString(),
        text: prepared.studentDoc.text,
      },
      {
        id: `${prepared.threadId}-${aiDoc.seq}`,
        from: 'ai',
        at: aiDoc.at.toISOString(),
        text: aiDoc.text,
      },
    ],
  };
}

