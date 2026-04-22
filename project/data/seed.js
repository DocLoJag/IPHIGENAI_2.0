/*
 * Seed data for the mock API.
 * Everything here mirrors what the real backend will return for the
 * endpoints documented in /docs/API.md. Field names and shapes should
 * match 1:1 with those contracts.
 *
 * Exposed globally as window.SEED so mock-client.js can read it.
 */
(function () {
  const NOW = new Date('2026-04-22T09:00:00+02:00').toISOString();

  const users = {
    'student-luca': {
      id: 'student-luca',
      role: 'student',
      name: 'Luca',
      full_name: 'Luca Bianchi',
      grade: 'Quarta scientifico',
      school: 'Liceo G. Galilei, Torino',
      tutor_id: 'tutor-chiara',
      avatar_initial: 'L',
    },
    'tutor-chiara': {
      id: 'tutor-chiara',
      role: 'tutor',
      name: 'Chiara',
      full_name: 'Chiara Rizzo',
      avatar_initial: 'C',
      students: ['student-luca'],
    },
    'admin-iphi': {
      id: 'admin-iphi',
      role: 'admin',
      name: 'Admin',
      full_name: 'Admin IphigenAI',
      avatar_initial: 'A',
    },
  };

  // Credenziali mock (admin crea manualmente account, niente registrazione)
  const credentials = [
    { username: 'luca',   password: 'luca2026',   user_id: 'student-luca' },
    { username: 'chiara', password: 'chiara2026', user_id: 'tutor-chiara' },
    { username: 'admin',  password: 'admin2026',  user_id: 'admin-iphi' },
  ];

  // Sessione corrente ("dove eri rimasto")
  const currentSession = {
    id: 'sess-2026-04-21-math',
    student_id: 'student-luca',
    subject: 'matematica',
    topic: 'Equazioni di secondo grado',
    focus: 'il momento del delta',
    started_at: '2026-04-21T21:38:00+02:00',
    last_touched_at: '2026-04-21T22:14:00+02:00',
    status: 'paused',
    progress: { completed: 3, total: 5, elapsed_minutes: 24 },
    resume_blurb:
      "Eri arrivato al terzo esercizio. La formula ti torna, ma quando il coefficiente era negativo ti fermavi. Riprendiamo da lì — stavolta più piano.",
    next_exercise_id: 'ex-delta-neg-3',
  };

  // Attività proposte ("cosa ti aspetta")
  const upcomingActivities = [
    {
      id: 'act-math-verifica',
      kind: 'review',
      subject: 'matematica',
      title: 'Riprendiamo insieme le equazioni prima del compito.',
      kicker: 'per la verifica di mercoledì',
      estimated_minutes: 30,
      prepared_by: 'tutor-chiara',
      prepared_at: '2026-04-21T22:14:00+02:00',
      priority: 1,
      linked_session_id: 'sess-2026-04-21-math',
    },
    {
      id: 'act-promessi-lettura',
      kind: 'guided-reading',
      subject: 'italiano',
      title: 'Due pagine dei Promessi Sposi, a voce alta.',
      kicker: 'pronto quando vuoi',
      estimated_minutes: 15,
      prepared_by: null,
      priority: 2,
    },
    {
      id: 'act-logica-test',
      kind: 'quick-test',
      subject: 'logica',
      title: "Dieci domande di logica, giusto per tenere l'occhio.",
      kicker: 'simulazione leggera',
      estimated_minutes: 10,
      prepared_by: null,
      priority: 3,
    },
  ];

  // Cassetta degli attrezzi — artifact
  const artifacts = [
    {
      id: 'art-parabola-viva',
      title: 'Parabola viva',
      kind: 'simulation',
      subject: 'matematica',
      description:
        "Muovi i coefficienti a, b, c e osserva come cambia la parabola. Serve a capire il delta con gli occhi, non solo con la formula.",
      created_by: 'tutor-chiara',
      created_at: '2026-04-18T15:10:00+02:00',
      tags: ['equazioni', 'delta', 'grafico'],
      preview: 'parabola',
    },
    {
      id: 'art-rinascimento-mappa',
      title: 'Mappa del Rinascimento',
      kind: 'concept-map',
      subject: 'storia',
      description:
        "Partendo dal 1492, quattro nodi attorno — arte, scienza, politica, scoperte geografiche — con i fili che li legano.",
      created_by: 'student-luca',
      created_at: '2026-04-15T18:00:00+02:00',
      tags: ['1492', 'italia', 'arte'],
      preview: 'map',
    },
    {
      id: 'art-cellula-strati',
      title: 'Cellula a strati',
      kind: 'interactive-diagram',
      subject: 'biologia',
      description:
        "Uno schema a bulbo della cellula eucariote: strati apribili per membrana, citoplasma, nucleo.",
      created_by: 'tutor-chiara',
      created_at: '2026-04-10T10:30:00+02:00',
      tags: ['biologia', 'eucariote'],
      preview: 'cell',
    },
  ];

  // Compiti chiusi ("già alle spalle")
  const completed = [
    {
      id: 'done-promessi-cap4',
      title: 'Capitolo 4 dei Promessi Sposi',
      kind: 'reading',
      completed_at: '2026-04-21T22:40:00+02:00',
      duration_minutes: 22,
      outcome: 'letto ad alta voce, scorrevole',
      subject: 'italiano',
    },
    {
      id: 'done-delta-esercizi',
      title: 'Dieci problemi sul delta',
      kind: 'exercise-set',
      completed_at: '2026-04-21T19:30:00+02:00',
      duration_minutes: 28,
      outcome: "9 su 10 — ultimo sbagliato, capito il perché",
      subject: 'matematica',
    },
    {
      id: 'done-rinascimento-riass',
      title: 'Riassunto del Rinascimento',
      kind: 'writing',
      completed_at: '2026-04-22T14:10:00+02:00',
      duration_minutes: 18,
      outcome: 'consegnato, rientrato nelle 200 parole',
      subject: 'storia',
    },
    {
      id: 'done-logica-test-2',
      title: "Quiz di logica, seconda sessione",
      kind: 'quick-test',
      completed_at: '2026-04-20T17:00:00+02:00',
      duration_minutes: 12,
      outcome: '8 su 10 — gli insiemi ancora incerti',
      subject: 'logica',
    },
    {
      id: 'done-leopardi-analisi',
      title: "Analisi dell'Infinito di Leopardi",
      kind: 'analysis',
      completed_at: '2026-04-19T20:40:00+02:00',
      duration_minutes: 35,
      outcome: 'hai visto bene il passaggio siepe → infinito',
      subject: 'italiano',
    },
  ];

  // Messaggi con tutor umana Chiara
  const chiaraThread = {
    id: 'thread-luca-chiara',
    participants: ['student-luca', 'tutor-chiara'],
    messages: [
      {
        id: 'msg-1',
        from: 'tutor-chiara',
        at: '2026-04-20T18:20:00+02:00',
        kind: 'tutor',
        text:
          "Stasera proviamo a fare due esercizi insieme — niente verifica, solo per prendere confidenza.",
      },
      {
        id: 'msg-2',
        from: 'tutor-chiara',
        at: '2026-04-21T21:42:00+02:00',
        kind: 'tutor',
        text:
          "Benissimo sulla formula. Se vuoi, ti lascio uno scalino più morbido per il coefficiente negativo.",
      },
      {
        id: 'msg-3',
        from: 'student-luca',
        at: '2026-04-21T21:50:00+02:00',
        kind: 'student',
        text: "Ok, domani mattina ci riprovo. Il terzo non mi è uscito.",
      },
      {
        id: 'msg-4',
        from: 'tutor-chiara',
        at: '2026-04-21T22:14:00+02:00',
        kind: 'tutor',
        text:
          "Ho messo due esercizi in più per mercoledì, fammi sapere se il passaggio al delta ti torna.",
      },
    ],
  };

  // Chat col tutor AI (sessione in corso)
  const aiThread = {
    id: 'ai-thread-luca-math',
    student_id: 'student-luca',
    subject: 'matematica',
    topic: 'Equazioni di secondo grado',
    opened_at: '2026-04-22T08:15:00+02:00',
    messages: [
      {
        id: 'ai-1',
        from: 'ai',
        at: '2026-04-22T08:15:00+02:00',
        text:
          "Ciao Luca. Ripartiamo da dove eri ieri? Il delta ti ha dato qualche difficoltà quando il coefficiente era negativo. Ti propongo un esempio nuovo, piano.",
      },
      {
        id: 'ai-2',
        from: 'student',
        at: '2026-04-22T08:16:00+02:00',
        text: 'ok, proviamo con un esempio nuovo',
      },
      {
        id: 'ai-3',
        from: 'ai',
        at: '2026-04-22T08:16:30+02:00',
        text:
          "Bene. Prendiamo −2x² + 3x + 1 = 0. Prima di partire, qual è il segno di a?",
      },
    ],
  };

  // Esercizio corrente (dettaglio sessione)
  const exercises = {
    'ex-delta-neg-3': {
      id: 'ex-delta-neg-3',
      session_id: 'sess-2026-04-21-math',
      index: 3,
      of: 5,
      subject: 'matematica',
      topic: 'Equazioni di secondo grado',
      prompt:
        "Considera l'equazione seguente. Prima di calcolare il delta, osserva il segno del coefficiente direttore a. Cosa ti aspetti?",
      formula: '−2x² + 3x + 1 = 0',
      choices: [
        { id: 'c-a', letter: 'A', text: 'Il grafico è una parabola rivolta verso il basso.' },
        { id: 'c-b', letter: 'B', text: 'Il grafico è una parabola rivolta verso l\'alto.' },
        { id: 'c-c', letter: 'C', text: "Il segno di a non c'entra con l'apertura." },
        { id: 'c-d', letter: 'D', text: 'Dipende dal valore di c.' },
      ],
      correct_choice_id: 'c-a',
      hint:
        'Guarda a: se è negativo, la parabola è a ∩. Prima ancora di calcolare il delta, questo ti dice dove cercare le soluzioni.',
    },
  };

  // Costellazione materie
  const constellation = {
    updated_at: '2026-04-21T22:14:00+02:00',
    nodes: [
      { id: 'n-funz',   label: 'Funzioni',       x: 70,  y: 60,  r: 8, state: 'consolidated' },
      { id: 'n-eq2',    label: 'Equazioni 2°',   x: 140, y: 30,  r: 10, state: 'working-on' },
      { id: 'n-geom',   label: 'Geometria',      x: 220, y: 70,  r: 6, state: 'consolidated' },
      { id: 'n-log',    label: 'Logaritmi',      x: 290, y: 45,  r: 5, state: 'to-review' },
      { id: 'n-prom',   label: 'Promessi Sposi', x: 100, y: 130, r: 7, state: 'fresh' },
      { id: 'n-leop',   label: 'Leopardi',       x: 190, y: 150, r: 9, state: 'consolidated' },
      { id: 'n-dante',  label: 'Dante',          x: 280, y: 130, r: 6, state: 'behind' },
      { id: 'n-stor',   label: 'Storia',         x: 60,  y: 210, r: 5, state: 'to-review' },
      { id: 'n-filo',   label: 'Filosofia',      x: 160, y: 225, r: 6, state: 'consolidated' },
      { id: 'n-ingl',   label: 'Inglese',        x: 250, y: 205, r: 7, state: 'fresh' },
    ],
    edges: [
      ['n-funz', 'n-eq2'], ['n-eq2', 'n-geom'], ['n-geom', 'n-log'],
      ['n-prom', 'n-leop'], ['n-leop', 'n-dante'],
      ['n-stor', 'n-filo'], ['n-filo', 'n-ingl'],
      ['n-funz', 'n-prom'], ['n-geom', 'n-dante'],
    ],
    narrative: "Stai consolidando le equazioni. Dante è un po' indietro, ma puoi recuperare senza fretta.",
  };

  window.SEED = {
    NOW,
    users,
    credentials,
    currentSession,
    upcomingActivities,
    artifacts,
    completed,
    chiaraThread,
    aiThread,
    exercises,
    constellation,
  };
})();
