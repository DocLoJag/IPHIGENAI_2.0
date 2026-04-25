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

export async function runTutorTurn(input: TutorTurnInput): Promise<{
  messages: SerializedMessage[];
}> {
  const msgCol = collections.aiMessages();

  // 1) prendiamo la history esistente
  const history = await msgCol
    .find({ thread_id: input.threadId })
    .sort({ seq: 1 })
    .toArray();

  const nextSeq = (history[history.length - 1]?.seq ?? 0) + 1;

  // 2) salviamo subito il messaggio studente
  const studentDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: nextSeq,
    from: 'student',
    at: new Date(),
    text: input.userText,
  };
  await msgCol.insertOne(studentDoc);

  // 3) chiamiamo Anthropic con l'history + ultimo turno
  const system = tutorSystemPrompt({
    studentName: input.studentName,
    grade: input.grade,
    subject: input.subject,
    topic: input.topic,
  });

  const trimmed = [...history, studentDoc].slice(-MAX_HISTORY_MESSAGES);
  const anthropicMessages = trimmed.map((m) => ({
    role: m.from === 'student' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  const response = await anthropic().messages.create({
    model: models.tutor,
    max_tokens: 1024,
    system,
    messages: anthropicMessages,
  });

  const replyText =
    response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim() || '…';

  const aiDoc: AiMessageDoc = {
    thread_id: input.threadId,
    seq: nextSeq + 1,
    from: 'ai',
    at: new Date(),
    text: replyText,
    model: response.model,
    tokens_in: response.usage?.input_tokens,
    tokens_out: response.usage?.output_tokens,
  };
  await msgCol.insertOne(aiDoc);

  // ID dei messaggi: la coppia (thread_id, seq) è univoca nell'indice Mongo,
  // quindi `${threadId}-${seq}` è una chiave deterministica e stabile per il client.
  return {
    messages: [
      {
        id: `${input.threadId}-${studentDoc.seq}`,
        from: 'student',
        at: studentDoc.at.toISOString(),
        text: studentDoc.text,
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
