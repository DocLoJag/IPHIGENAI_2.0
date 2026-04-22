import { and, eq, inArray } from 'drizzle-orm';
import { anthropic, models } from './anthropic.js';
import { CURATOR_SYSTEM_PROMPT } from './system-prompts.js';
import { db } from '../db/postgres.js';
import {
  completions,
  exerciseAttempts,
  exercises,
  sessions,
  students,
  topicNodes,
  users,
  type TopicNodeRow,
} from '../db/schema.js';
import { collections } from '../db/mongo.js';
import { id as mkId } from '../lib/ids.js';

type CuratorOutput = {
  narrative: string;
  resume_blurb: string;
  outcome: string;
  signals: {
    topic: string;
    confidence: number;
    stumble_points: string[];
    next_step_hint: string;
  };
  topic_state_suggestion: {
    topic_id: string | null;
    new_state: TopicNodeRow['state'] | null;
  };
};

export async function runCuratorForSession(sessionId: string): Promise<void> {
  // idempotenza: se esiste già una nota per questa sessione, skip
  const existing = await collections.curatorNotebook().findOne({ session_id: sessionId });
  if (existing) {
    console.log(`[curator] nota già esistente per ${sessionId}, skip`);
    return;
  }

  // carichiamo il contesto
  const [s] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!s) throw new Error(`Sessione ${sessionId} non trovata`);

  const [student] = await db.select().from(users).where(eq(users.id, s.studentId)).limit(1);
  const [studentMeta] = await db
    .select()
    .from(students)
    .where(eq(students.userId, s.studentId))
    .limit(1);

  const exs = await db.select().from(exercises).where(eq(exercises.sessionId, s.id));
  const attempts =
    exs.length > 0
      ? await db
          .select()
          .from(exerciseAttempts)
          .where(
            inArray(
              exerciseAttempts.exerciseId,
              exs.map((e) => e.id),
            ),
          )
      : [];

  const nodes = await db
    .select()
    .from(topicNodes)
    .where(eq(topicNodes.studentId, s.studentId));

  // costruiamo il prompt utente per il curator
  const userBlocks: string[] = [];
  userBlocks.push(
    `Studente: ${student?.name ?? s.studentId}${studentMeta?.grade ? ` (${studentMeta.grade})` : ''}.`,
  );
  userBlocks.push(`Sessione: ${s.subject} — ${s.topic}${s.focus ? ` — ${s.focus}` : ''}.`);
  userBlocks.push(
    `Progresso: ${s.completedCount} esercizi corretti su ${s.totalCount}, ${s.elapsedMinutes} minuti.`,
  );

  if (exs.length > 0) {
    userBlocks.push(`\nEsercizi e tentativi:`);
    for (const ex of exs) {
      const atts = attempts.filter((a) => a.exerciseId === ex.id);
      userBlocks.push(`- [${ex.idx}/${ex.ofTotal}] ${ex.prompt}`);
      if (ex.formula) userBlocks.push(`  formula: ${ex.formula}`);
      for (const a of atts) {
        userBlocks.push(
          `  tentativo: ${a.choiceId ?? '-'} → ${a.correct ? 'corretto' : 'sbagliato'}`,
        );
      }
    }
  }

  if (nodes.length > 0) {
    userBlocks.push(`\nCostellazione materie (nodi):`);
    for (const n of nodes) {
      userBlocks.push(`- ${n.id}: "${n.label}" (${n.state})`);
    }
  }

  userBlocks.push(
    `\nOra scrivi la nota (JSON come da istruzioni di sistema, nessun testo extra).`,
  );

  const response = await anthropic().messages.create({
    model: models.curator,
    max_tokens: 1200,
    system: CURATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userBlocks.join('\n') }],
  });

  const raw = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();

  let parsed: CuratorOutput;
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const json = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    parsed = JSON.parse(json) as CuratorOutput;
  } catch (err) {
    console.error('[curator] output non parsabile', err, raw);
    throw new Error('Curator output non valido');
  }

  // 1) taccuino Mongo
  await collections.curatorNotebook().insertOne({
    student_id: s.studentId,
    session_id: s.id,
    written_at: new Date(),
    voice: 'curator',
    body: parsed.narrative,
    signals: parsed.signals,
  });

  // 2) aggiornamento sessione: resume_blurb, closed_at se mancava
  await db
    .update(sessions)
    .set({
      resumeBlurb: parsed.resume_blurb,
      status: 'closed',
      closedAt: s.closedAt ?? new Date(),
    })
    .where(eq(sessions.id, s.id));

  // 3) riga in completions
  await db.insert(completions).values({
    id: mkId.completion(),
    studentId: s.studentId,
    title: `${capitalize(s.subject)} — ${s.topic}`,
    kind: 'exercise-set',
    subject: s.subject,
    completedAt: new Date(),
    durationMinutes: s.elapsedMinutes,
    outcome: parsed.outcome,
    sourceSessionId: s.id,
  });

  // 4) aggiornamento stato nodo costellazione (se suggerito)
  const sug = parsed.topic_state_suggestion;
  if (sug?.topic_id && sug.new_state) {
    await db
      .update(topicNodes)
      .set({ state: sug.new_state, updatedAt: new Date() })
      .where(and(eq(topicNodes.studentId, s.studentId), eq(topicNodes.id, sug.topic_id)));
  }

  console.log(`[curator] sessione ${s.id} processata`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
