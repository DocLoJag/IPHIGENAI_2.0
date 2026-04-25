import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { anthropic, models } from './anthropic.js';
import { CURATOR_SYSTEM_PROMPT } from './system-prompts.js';
import { db } from '../db/postgres.js';
import {
  activityProposals,
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

// Limite al numero di proposte che il curator può generare per sessione.
// Proteggerci da output patologici del modello; il prompt chiede 0-3.
const MAX_PROPOSALS_PER_SESSION = 5;

const proposalDraftSchema = z
  .object({
    kind: z.enum([
      'review',
      'guided-reading',
      'quick-test',
      'analysis',
      'writing',
      'exercise-set',
      'reading',
    ]),
    subject: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    kicker: z.string().trim().max(500).nullable().optional(),
    estimated_minutes: z.number().int().positive().max(600).nullable().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
    rationale: z.string().trim().max(2000).nullable().optional(),
  })
  .strip();

type ProposalDraft = z.infer<typeof proposalDraftSchema>;

// Validazione difensiva sul JSON dell'LLM. Se Claude restituisce qualcosa di
// fuori specifica (confidence non numerica, stumble_points non array, ecc.)
// lo normalizziamo in valori sicuri invece di scriverli grezzi su Mongo, dove
// poi il tutor leggerebbe spazzatura. `.passthrough()` lascia passare campi
// extra eventualmente aggiunti dal modello senza rompere il parsing.
const curatorOutputSchema = z
  .object({
    narrative: z.string().trim().min(1).max(8000),
    resume_blurb: z.string().trim().min(1).max(2000),
    outcome: z.string().trim().min(1).max(1000),
    signals: z
      .object({
        topic: z.string().trim().max(500).default(''),
        confidence: z.number().min(0).max(1).default(0.5),
        stumble_points: z.array(z.string().trim().max(500)).max(10).default([]),
        next_step_hint: z.string().trim().max(1000).default(''),
      })
      .passthrough(),
    topic_state_suggestion: z
      .object({
        topic_id: z.string().min(1).nullable().default(null),
        new_state: z
          .enum(['consolidated', 'working-on', 'fresh', 'to-review', 'behind'])
          .nullable()
          .default(null),
      })
      .nullable()
      .default(null),
    proposals: z.unknown().optional(),
  })
  .passthrough();

type CuratorOutput = z.infer<typeof curatorOutputSchema>;

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
    const rawObj = JSON.parse(json);
    parsed = curatorOutputSchema.parse(rawObj);
  } catch (err) {
    console.error('[curator] output non parsabile o non conforme', err, raw);
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

  // 5) proposte di task per il tutor (pending). L'idempotency vera è già il
  // check della nota Mongo all'inizio di runCuratorForSession: se siamo qui,
  // questa è la prima esecuzione per la sessione e nessuna proposta da curator
  // è stata ancora inserita.
  const drafts = validateProposals(parsed.proposals);
  if (drafts.length > 0) {
    const now = new Date();
    await db.insert(activityProposals).values(
      drafts.map((d) => ({
        id: mkId.proposal(),
        studentId: s.studentId,
        sourceSessionId: s.id,
        status: 'pending' as const,
        kind: d.kind,
        subject: d.subject,
        title: d.title,
        kicker: d.kicker ?? null,
        estimatedMinutes: d.estimated_minutes ?? null,
        priority: d.priority ?? 100,
        rationale: d.rationale ?? null,
        createdAt: now,
      })),
    );
    console.log(`[curator] ${drafts.length} proposte inserite per sessione ${s.id}`);
  }

  console.log(`[curator] sessione ${s.id} processata`);
}

// Valida le proposte generate dal modello. Scarta silenziosamente quelle
// malformate (kind fuori enum, titolo vuoto, ecc.) con un warn: un output
// parziale è meglio di un fallimento totale dell'intera elaborazione curator.
function validateProposals(raw: unknown): ProposalDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposalDraft[] = [];
  for (const item of raw.slice(0, MAX_PROPOSALS_PER_SESSION)) {
    const res = proposalDraftSchema.safeParse(item);
    if (res.success) {
      out.push(res.data);
    } else {
      console.warn('[curator] proposta scartata (schema invalido)', res.error.issues);
    }
  }
  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
