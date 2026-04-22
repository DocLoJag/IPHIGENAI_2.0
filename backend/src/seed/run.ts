/*
 * Seed — replica esatta di project/data/seed.js del frontend.
 * Obiettivo: dopo aver eseguito questo script il backend risponde con gli
 * stessi dati che il mock mostra, così il frontend gira invariato.
 *
 * Idempotente: puoi rilanciarlo, droppa e reinserisce nei dati di demo.
 */
import { sql as rawSql } from '../db/postgres.js';
import { db, closePostgres } from '../db/postgres.js';
import { connectMongo, closeMongo, collections } from '../db/mongo.js';
import {
  activities,
  aiThreads,
  artifacts,
  completions,
  exercises,
  messages,
  sessions,
  students,
  threads,
  topicEdges,
  topicNodes,
  users,
} from '../db/schema.js';
import { hashPassword } from '../auth/passwords.js';

async function wipe(): Promise<void> {
  // TRUNCATE con CASCADE per pulire tutto in un colpo
  await rawSql.unsafe(
    `TRUNCATE TABLE
       exercise_attempts, exercises,
       completions, activities,
       messages, threads, ai_threads,
       topic_edges, topic_nodes,
       artifacts, sessions,
       students, users,
       job_log
     RESTART IDENTITY CASCADE;`,
  );

  await collections.curatorNotebook().deleteMany({});
  await collections.aiMessages().deleteMany({});
  await collections.artifactBodies().deleteMany({});
}

async function main(): Promise<void> {
  await connectMongo();
  console.log('[seed] pulizia dati precedenti');
  await wipe();

  console.log('[seed] utenti e credenziali');

  const lucaHash = await hashPassword('luca2026');
  const chiaraHash = await hashPassword('chiara2026');
  const adminHash = await hashPassword('admin2026');

  await db.insert(users).values([
    {
      id: 'student-luca',
      role: 'student',
      username: 'luca',
      passwordHash: lucaHash,
      name: 'Luca',
      fullName: 'Luca Bianchi',
      avatarInitial: 'L',
    },
    {
      id: 'tutor-chiara',
      role: 'tutor',
      username: 'chiara',
      passwordHash: chiaraHash,
      name: 'Chiara',
      fullName: 'Chiara Rizzo',
      avatarInitial: 'C',
    },
    {
      id: 'admin-iphi',
      role: 'admin',
      username: 'admin',
      passwordHash: adminHash,
      name: 'Admin',
      fullName: 'Admin IphigenAI',
      avatarInitial: 'A',
    },
  ]);

  await db.insert(students).values({
    userId: 'student-luca',
    grade: 'Quarta scientifico',
    school: 'Liceo G. Galilei, Torino',
    tutorId: 'tutor-chiara',
  });

  console.log('[seed] sessione corrente + esercizio');

  await db.insert(sessions).values({
    id: 'sess-2026-04-21-math',
    studentId: 'student-luca',
    subject: 'matematica',
    topic: 'Equazioni di secondo grado',
    focus: 'il momento del delta',
    status: 'paused',
    startedAt: new Date('2026-04-21T21:38:00+02:00'),
    lastTouchedAt: new Date('2026-04-21T22:14:00+02:00'),
    completedCount: 3,
    totalCount: 5,
    elapsedMinutes: 24,
    resumeBlurb:
      'Eri arrivato al terzo esercizio. La formula ti torna, ma quando il coefficiente era negativo ti fermavi. Riprendiamo da lì — stavolta più piano.',
    nextExerciseId: 'ex-delta-neg-3',
  });

  await db.insert(exercises).values({
    id: 'ex-delta-neg-3',
    sessionId: 'sess-2026-04-21-math',
    idx: 3,
    ofTotal: 5,
    subject: 'matematica',
    topic: 'Equazioni di secondo grado',
    prompt:
      "Considera l'equazione seguente. Prima di calcolare il delta, osserva il segno del coefficiente direttore a. Cosa ti aspetti?",
    formula: '−2x² + 3x + 1 = 0',
    choices: [
      { id: 'c-a', letter: 'A', text: 'Il grafico è una parabola rivolta verso il basso.' },
      { id: 'c-b', letter: 'B', text: "Il grafico è una parabola rivolta verso l'alto." },
      { id: 'c-c', letter: 'C', text: "Il segno di a non c'entra con l'apertura." },
      { id: 'c-d', letter: 'D', text: 'Dipende dal valore di c.' },
    ],
    correctChoiceId: 'c-a',
    hint:
      "Guarda a: se è negativo, la parabola è a ∩. Prima ancora di calcolare il delta, questo ti dice dove cercare le soluzioni.",
  });

  console.log('[seed] attività proposte');

  await db.insert(activities).values([
    {
      id: 'act-math-verifica',
      studentId: 'student-luca',
      kind: 'review',
      subject: 'matematica',
      title: 'Riprendiamo insieme le equazioni prima del compito.',
      kicker: 'per la verifica di mercoledì',
      estimatedMinutes: 30,
      preparedBy: 'tutor-chiara',
      preparedAt: new Date('2026-04-21T22:14:00+02:00'),
      priority: 1,
      linkedSessionId: 'sess-2026-04-21-math',
    },
    {
      id: 'act-promessi-lettura',
      studentId: 'student-luca',
      kind: 'guided-reading',
      subject: 'italiano',
      title: 'Due pagine dei Promessi Sposi, a voce alta.',
      kicker: 'pronto quando vuoi',
      estimatedMinutes: 15,
      priority: 2,
    },
    {
      id: 'act-logica-test',
      studentId: 'student-luca',
      kind: 'quick-test',
      subject: 'logica',
      title: "Dieci domande di logica, giusto per tenere l'occhio.",
      kicker: 'simulazione leggera',
      estimatedMinutes: 10,
      priority: 3,
    },
  ]);

  console.log('[seed] artifact');

  await db.insert(artifacts).values([
    {
      id: 'art-parabola-viva',
      studentId: 'student-luca',
      createdBy: 'tutor-chiara',
      title: 'Parabola viva',
      kind: 'simulation',
      subject: 'matematica',
      description:
        'Muovi i coefficienti a, b, c e osserva come cambia la parabola. Serve a capire il delta con gli occhi, non solo con la formula.',
      tags: ['equazioni', 'delta', 'grafico'],
      preview: 'parabola',
      createdAt: new Date('2026-04-18T15:10:00+02:00'),
      updatedAt: new Date('2026-04-18T15:10:00+02:00'),
    },
    {
      id: 'art-rinascimento-mappa',
      studentId: 'student-luca',
      createdBy: 'student-luca',
      title: 'Mappa del Rinascimento',
      kind: 'concept-map',
      subject: 'storia',
      description:
        'Partendo dal 1492, quattro nodi attorno — arte, scienza, politica, scoperte geografiche — con i fili che li legano.',
      tags: ['1492', 'italia', 'arte'],
      preview: 'map',
      createdAt: new Date('2026-04-15T18:00:00+02:00'),
      updatedAt: new Date('2026-04-15T18:00:00+02:00'),
    },
    {
      id: 'art-cellula-strati',
      studentId: 'student-luca',
      createdBy: 'tutor-chiara',
      title: 'Cellula a strati',
      kind: 'interactive-diagram',
      subject: 'biologia',
      description:
        'Uno schema a bulbo della cellula eucariote: strati apribili per membrana, citoplasma, nucleo.',
      tags: ['biologia', 'eucariote'],
      preview: 'cell',
      createdAt: new Date('2026-04-10T10:30:00+02:00'),
      updatedAt: new Date('2026-04-10T10:30:00+02:00'),
    },
  ]);

  // Body Mongo per l'artifact parabola
  await collections.artifactBodies().insertMany([
    {
      _id: 'art-parabola-viva',
      kind: 'simulation',
      schema_version: 1,
      params: {
        a: { min: -5, max: 5, default: -2, step: 0.1 },
        b: { min: -5, max: 5, default: 3, step: 0.1 },
        c: { min: -5, max: 5, default: 1, step: 0.1 },
      },
      view: { kind: 'function-plot', expression: 'a*x^2 + b*x + c', range_x: [-6, 6] },
    },
    {
      _id: 'art-rinascimento-mappa',
      kind: 'concept-map',
      schema_version: 1,
      center: { id: 'c', label: '1492' },
      nodes: [
        { id: 'n1', label: 'arte', at: [20, 22] },
        { id: 'n2', label: 'scienza', at: [-20, 22] },
        { id: 'n3', label: 'politica', at: [20, -22] },
        { id: 'n4', label: 'scoperte geografiche', at: [-20, -22] },
      ],
      edges: [
        ['c', 'n1'],
        ['c', 'n2'],
        ['c', 'n3'],
        ['c', 'n4'],
      ],
    },
  ]);

  console.log('[seed] completamenti');

  await db.insert(completions).values([
    {
      id: 'done-promessi-cap4',
      studentId: 'student-luca',
      title: 'Capitolo 4 dei Promessi Sposi',
      kind: 'reading',
      subject: 'italiano',
      completedAt: new Date('2026-04-21T22:40:00+02:00'),
      durationMinutes: 22,
      outcome: 'letto ad alta voce, scorrevole',
    },
    {
      id: 'done-delta-esercizi',
      studentId: 'student-luca',
      title: 'Dieci problemi sul delta',
      kind: 'exercise-set',
      subject: 'matematica',
      completedAt: new Date('2026-04-21T19:30:00+02:00'),
      durationMinutes: 28,
      outcome: '9 su 10 — ultimo sbagliato, capito il perché',
    },
    {
      id: 'done-rinascimento-riass',
      studentId: 'student-luca',
      title: 'Riassunto del Rinascimento',
      kind: 'writing',
      subject: 'storia',
      completedAt: new Date('2026-04-22T14:10:00+02:00'),
      durationMinutes: 18,
      outcome: 'consegnato, rientrato nelle 200 parole',
    },
    {
      id: 'done-logica-test-2',
      studentId: 'student-luca',
      title: 'Quiz di logica, seconda sessione',
      kind: 'quick-test',
      subject: 'logica',
      completedAt: new Date('2026-04-20T17:00:00+02:00'),
      durationMinutes: 12,
      outcome: '8 su 10 — gli insiemi ancora incerti',
    },
    {
      id: 'done-leopardi-analisi',
      studentId: 'student-luca',
      title: "Analisi dell'Infinito di Leopardi",
      kind: 'analysis',
      subject: 'italiano',
      completedAt: new Date('2026-04-19T20:40:00+02:00'),
      durationMinutes: 35,
      outcome: 'hai visto bene il passaggio siepe → infinito',
    },
  ]);

  console.log('[seed] thread tutor umano (Chiara)');

  await db.insert(threads).values({
    id: 'thread-luca-chiara',
    participants: ['student-luca', 'tutor-chiara'],
  });

  await db.insert(messages).values([
    {
      id: 'msg-1',
      threadId: 'thread-luca-chiara',
      fromUser: 'tutor-chiara',
      kind: 'tutor',
      at: new Date('2026-04-20T18:20:00+02:00'),
      text: 'Stasera proviamo a fare due esercizi insieme — niente verifica, solo per prendere confidenza.',
    },
    {
      id: 'msg-2',
      threadId: 'thread-luca-chiara',
      fromUser: 'tutor-chiara',
      kind: 'tutor',
      at: new Date('2026-04-21T21:42:00+02:00'),
      text: 'Benissimo sulla formula. Se vuoi, ti lascio uno scalino più morbido per il coefficiente negativo.',
    },
    {
      id: 'msg-3',
      threadId: 'thread-luca-chiara',
      fromUser: 'student-luca',
      kind: 'student',
      at: new Date('2026-04-21T21:50:00+02:00'),
      text: 'Ok, domani mattina ci riprovo. Il terzo non mi è uscito.',
    },
    {
      id: 'msg-4',
      threadId: 'thread-luca-chiara',
      fromUser: 'tutor-chiara',
      kind: 'tutor',
      at: new Date('2026-04-21T22:14:00+02:00'),
      text: 'Ho messo due esercizi in più per mercoledì, fammi sapere se il passaggio al delta ti torna.',
    },
  ]);

  console.log('[seed] thread AI + messaggi');

  await db.insert(aiThreads).values({
    id: 'ai-thread-luca-math',
    studentId: 'student-luca',
    subject: 'matematica',
    topic: 'Equazioni di secondo grado',
    openedAt: new Date('2026-04-22T08:15:00+02:00'),
  });

  await collections.aiMessages().insertMany([
    {
      thread_id: 'ai-thread-luca-math',
      seq: 1,
      from: 'ai',
      at: new Date('2026-04-22T08:15:00+02:00'),
      text:
        "Ciao Luca. Ripartiamo da dove eri ieri? Il delta ti ha dato qualche difficoltà quando il coefficiente era negativo. Ti propongo un esempio nuovo, piano.",
    },
    {
      thread_id: 'ai-thread-luca-math',
      seq: 2,
      from: 'student',
      at: new Date('2026-04-22T08:16:00+02:00'),
      text: 'ok, proviamo con un esempio nuovo',
    },
    {
      thread_id: 'ai-thread-luca-math',
      seq: 3,
      from: 'ai',
      at: new Date('2026-04-22T08:16:30+02:00'),
      text: "Bene. Prendiamo −2x² + 3x + 1 = 0. Prima di partire, qual è il segno di a?",
    },
  ]);

  console.log('[seed] costellazione materie');

  const nodes = [
    { id: 'n-funz', label: 'Funzioni', x: 70, y: 60, r: 8, state: 'consolidated' as const },
    { id: 'n-eq2', label: 'Equazioni 2°', x: 140, y: 30, r: 10, state: 'working-on' as const },
    { id: 'n-geom', label: 'Geometria', x: 220, y: 70, r: 6, state: 'consolidated' as const },
    { id: 'n-log', label: 'Logaritmi', x: 290, y: 45, r: 5, state: 'to-review' as const },
    { id: 'n-prom', label: 'Promessi Sposi', x: 100, y: 130, r: 7, state: 'fresh' as const },
    { id: 'n-leop', label: 'Leopardi', x: 190, y: 150, r: 9, state: 'consolidated' as const },
    { id: 'n-dante', label: 'Dante', x: 280, y: 130, r: 6, state: 'behind' as const },
    { id: 'n-stor', label: 'Storia', x: 60, y: 210, r: 5, state: 'to-review' as const },
    { id: 'n-filo', label: 'Filosofia', x: 160, y: 225, r: 6, state: 'consolidated' as const },
    { id: 'n-ingl', label: 'Inglese', x: 250, y: 205, r: 7, state: 'fresh' as const },
  ];

  await db.insert(topicNodes).values(
    nodes.map((n) => ({
      id: n.id,
      studentId: 'student-luca',
      label: n.label,
      state: n.state,
      x: n.x,
      y: n.y,
      r: n.r,
      updatedAt: new Date('2026-04-21T22:14:00+02:00'),
    })),
  );

  const edges: Array<[string, string]> = [
    ['n-funz', 'n-eq2'],
    ['n-eq2', 'n-geom'],
    ['n-geom', 'n-log'],
    ['n-prom', 'n-leop'],
    ['n-leop', 'n-dante'],
    ['n-stor', 'n-filo'],
    ['n-filo', 'n-ingl'],
    ['n-funz', 'n-prom'],
    ['n-geom', 'n-dante'],
  ];

  await db.insert(topicEdges).values(
    edges.map(([a, b]) => ({ studentId: 'student-luca', nodeA: a, nodeB: b })),
  );

  console.log('[seed] done');
}

main()
  .then(async () => {
    await closeMongo();
    await closePostgres();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed] errore', err);
    await closeMongo().catch(() => {});
    await closePostgres().catch(() => {});
    process.exit(1);
  });
