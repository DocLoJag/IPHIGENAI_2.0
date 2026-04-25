import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
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

const MAX_HISTORY_MESSAGES = 40;

/**
 * Carica la history del thread, salva il messaggio dello studente e prepara
 * i parametri del prompt. Comune sia al path sincrono che a quello streaming.
 */
async function preparePrompt(input: TutorTurnInput): Promise<{
  studentDoc: AiMessageDoc;
  studentSeq: number;
  aiSeq: number;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}> {
  const msgCol = collections.aiMessages();

  const history = await msgCol
    .find({ thread_id: input.threadId })
    .sort({ seq: 1 })
    .toArray();

  const studentSeq = (history[history.length - 1]?.seq ?? 0) + 1;

  const studentDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: studentSeq,
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
  const messages = trimmed.map((m) => ({
    role: m.from === 'student' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  return { studentDoc, studentSeq, aiSeq: studentSeq + 1, system, messages };
}

/** Versione sincrona: chiama Claude e ritorna la coppia (studente, AI) intera. */
export async function runTutorTurn(input: TutorTurnInput): Promise<{
  messages: SerializedMessage[];
}> {
  const prep = await preparePrompt(input);

  const response = await anthropic().messages.create({
    model: models.tutor,
    max_tokens: 1024,
    system: prep.system,
    messages: prep.messages,
  });

  const replyText =
    response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim() || '…';

  const aiDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: prep.aiSeq,
    from: 'ai',
    at: new Date(),
    text: replyText,
    model: response.model,
    tokens_in: response.usage?.input_tokens,
    tokens_out: response.usage?.output_tokens,
  };
  await collections.aiMessages().insertOne(aiDoc);

  return {
    messages: [
      {
        id: `${input.threadId}-${prep.studentDoc.seq}`,
        from: 'student',
        at: prep.studentDoc.at.toISOString(),
        text: prep.studentDoc.text,
      },
      {
        id: `${input.threadId}-${aiDoc.seq}`,
        from: 'ai',
        at: aiDoc.at.toISOString(),
        text: aiDoc.text,
      },
    ],
  };
}

/**
 * Versione streaming: salva subito il messaggio studente, apre lo stream Anthropic
 * e ritorna un controller. Chi chiama deve agganciarsi a `stream.on('text', ...)`
 * per i delta e poi invocare `finalize()` per persistere la risposta completa.
 *
 * Se il client si stacca, è dovere del chiamante invocare `stream.controller.abort()`.
 */
export async function startTutorStream(input: TutorTurnInput): Promise<{
  studentMsg: SerializedMessage;
  aiMsgId: string;
  aiSeq: number;
  stream: MessageStream;
  finalize: () => Promise<SerializedMessage>;
}> {
  const prep = await preparePrompt(input);

  const stream = anthropic().messages.stream({
    model: models.tutor,
    max_tokens: 1024,
    system: prep.system,
    messages: prep.messages,
  });

  const studentMsg: SerializedMessage = {
    id: `${input.threadId}-${prep.studentDoc.seq}`,
    from: 'student',
    at: prep.studentDoc.at.toISOString(),
    text: prep.studentDoc.text,
  };

  const aiMsgId = `${input.threadId}-${prep.aiSeq}`;

  const finalize = async (): Promise<SerializedMessage> => {
    const finalMessage = await stream.finalMessage();
    const replyText =
      finalMessage.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n')
        .trim() || '…';
    const aiDoc: AiMessageDoc = {
      thread_id: input.threadId,
      seq: prep.aiSeq,
      from: 'ai',
      at: new Date(),
      text: replyText,
      model: finalMessage.model,
      tokens_in: finalMessage.usage?.input_tokens,
      tokens_out: finalMessage.usage?.output_tokens,
    };
    await collections.aiMessages().insertOne(aiDoc);
    return {
      id: aiMsgId,
      from: 'ai',
      at: aiDoc.at.toISOString(),
      text: aiDoc.text,
    };
  };

  return { studentMsg, aiMsgId, aiSeq: prep.aiSeq, stream, finalize };
}
