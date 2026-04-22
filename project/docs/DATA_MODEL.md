# IphigenAI — Data Model

Due layer, scelti per natura dei dati.

## PostgreSQL — strutturato e relazionale

```sql
-- ─── utenti ────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('student', 'tutor', 'admin');

CREATE TABLE users (
  id              TEXT PRIMARY KEY,            -- es. 'student-luca'
  role            user_role NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,               -- bcrypt/argon2
  name            TEXT NOT NULL,               -- nome proprio
  full_name       TEXT,
  avatar_initial  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at     TIMESTAMPTZ
);

CREATE TABLE students (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  grade      TEXT,                -- es. 'Quarta scientifico'
  school     TEXT,
  tutor_id   TEXT REFERENCES users(id)
);

-- ─── sessioni di studio ───────────────────────────────
CREATE TYPE session_status AS ENUM ('active', 'paused', 'closed');

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  student_id        TEXT NOT NULL REFERENCES users(id),
  subject           TEXT NOT NULL,
  topic             TEXT NOT NULL,
  focus             TEXT,
  status            session_status NOT NULL DEFAULT 'active',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_touched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  completed_count   INT NOT NULL DEFAULT 0,
  total_count       INT NOT NULL DEFAULT 0,
  elapsed_minutes   INT NOT NULL DEFAULT 0,
  resume_blurb      TEXT,                      -- scritto dal curatore a fine sessione
  next_exercise_id  TEXT
);
CREATE INDEX sessions_student_status ON sessions(student_id, status, last_touched_at DESC);

-- ─── esercizi (template + istanza per sessione) ──────
CREATE TABLE exercises (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  idx                INT NOT NULL,
  of_total           INT NOT NULL,
  subject            TEXT NOT NULL,
  topic              TEXT NOT NULL,
  prompt             TEXT NOT NULL,
  formula            TEXT,                     -- stringa; per formule complesse → latex in Mongo
  choices            JSONB NOT NULL,           -- [{id, letter, text}]
  correct_choice_id  TEXT,
  hint               TEXT
);

CREATE TABLE exercise_attempts (
  id              BIGSERIAL PRIMARY KEY,
  exercise_id     TEXT NOT NULL REFERENCES exercises(id),
  student_id      TEXT NOT NULL REFERENCES users(id),
  choice_id       TEXT,
  correct         BOOLEAN,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  feedback_text   TEXT
);

-- ─── attività proposte ("cosa ti aspetta") ────────────
CREATE TYPE activity_kind AS ENUM ('review', 'guided-reading', 'quick-test', 'analysis', 'writing', 'exercise-set');

CREATE TABLE activities (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES users(id),
  kind                activity_kind NOT NULL,
  subject             TEXT NOT NULL,
  title               TEXT NOT NULL,
  kicker              TEXT,
  estimated_minutes   INT,
  prepared_by         TEXT REFERENCES users(id),  -- tutor umano o null (auto)
  prepared_at         TIMESTAMPTZ,
  priority            INT NOT NULL DEFAULT 100,
  linked_session_id   TEXT REFERENCES sessions(id),
  scheduled_for       TIMESTAMPTZ,                -- BullMQ la rende visibile a questa data
  dismissed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);
CREATE INDEX activities_student_visible ON activities(student_id, scheduled_for, completed_at, dismissed_at);

-- ─── completamenti ("già alle spalle") ────────────────
CREATE TABLE completions (
  id                TEXT PRIMARY KEY,
  student_id        TEXT NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  kind              activity_kind NOT NULL,
  subject           TEXT NOT NULL,
  completed_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INT,
  outcome           TEXT,                        -- riga narrativa dal curatore
  source_session_id TEXT REFERENCES sessions(id),
  source_activity_id TEXT REFERENCES activities(id)
);
CREATE INDEX completions_student_recent ON completions(student_id, completed_at DESC);

-- ─── thread messaggi (studente ↔ tutor umano) ─────────
CREATE TABLE threads (
  id            TEXT PRIMARY KEY,
  participants  TEXT[] NOT NULL,             -- [student_id, tutor_id]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  from_user  TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,                  -- 'student' | 'tutor'
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  text       TEXT NOT NULL,
  read_at    TIMESTAMPTZ
);
CREATE INDEX messages_thread_time ON messages(thread_id, at);

-- ─── thread AI (leggero su Postgres, corpi in Mongo) ─
CREATE TABLE ai_threads (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES users(id),
  subject      TEXT,
  topic        TEXT,
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);
-- messaggi AI → in Mongo (ai_messages.<thread_id>) perché spesso strutturati
-- con tool-use, citazioni, ragionamenti; schema evolve.

-- ─── costellazione materie (stato per studente) ──────
CREATE TYPE topic_state AS ENUM ('consolidated', 'working-on', 'fresh', 'to-review', 'behind');

CREATE TABLE topic_nodes (
  id          TEXT,
  student_id  TEXT NOT NULL REFERENCES users(id),
  label       TEXT NOT NULL,
  subject     TEXT,
  state       topic_state NOT NULL,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  r           REAL NOT NULL DEFAULT 6,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, id)
);

CREATE TABLE topic_edges (
  student_id  TEXT NOT NULL REFERENCES users(id),
  node_a      TEXT NOT NULL,
  node_b      TEXT NOT NULL,
  PRIMARY KEY (student_id, node_a, node_b)
);

-- ─── artifact (riga strutturata, corpo in Mongo) ─────
CREATE TABLE artifacts (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id),   -- proprietario
  created_by  TEXT NOT NULL REFERENCES users(id),   -- autore (può essere tutor)
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                        -- simulation|concept-map|interactive-diagram|…
  subject     TEXT,
  description TEXT,
  tags        TEXT[] DEFAULT '{}',
  preview     TEXT,                                 -- 'parabola'|'map'|'cell'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX artifacts_student_subject ON artifacts(student_id, subject);

-- ─── job di coda (BullMQ tiene il vero stato in Redis;
--                 qui solo outbox per audit / idempotenza) ─
CREATE TABLE job_log (
  id           BIGSERIAL PRIMARY KEY,
  job_name     TEXT NOT NULL,
  ref_type     TEXT,             -- es. 'session'
  ref_id       TEXT,
  payload      JSONB,
  run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL,    -- 'queued'|'done'|'failed'
  error        TEXT
);
```

## MongoDB — documenti liberi

Tre collection, ciascuna con schema che evolve senza migration.

### `curator_notebook`
Il "taccuino in prima persona" del curatore della memoria. Una riga per sessione chiusa. È il testo da cui il backend estrae `resume_blurb`, `completions.outcome`, la `narrative` della costellazione.

```js
{
  _id: ObjectId,
  student_id: 'student-luca',
  session_id: 'sess-…',
  written_at: ISODate(),
  voice: 'curator',          // sempre prima persona del curatore
  body: "Oggi Luca ha fatto fatica sul delta con coefficiente negativo. La formula la sa, ma quando a è minore di zero si confonde sul segno… Propongo di ripartire con una parabola rivolta in basso, magari al grafico prima della formula.",
  signals: {                 // tag semi-strutturati derivati
    topic: 'equazioni-2',
    confidence: 0.62,
    stumble_points: ['segno di a'],
    next_step_hint: 'partire dal grafico'
  }
}
```

### `ai_messages`
Una collection per thread AI (o collection unica con `thread_id` indice). Messaggi grezzi dal LLM, con eventuale structured output.

```js
{
  _id: ObjectId,
  thread_id: 'ai-thread-…',
  seq: 3,
  from: 'ai' | 'student',
  at: ISODate(),
  text: "Bene. Prendiamo −2x² + 3x + 1 = 0…",
  model: 'claude-sonnet-4-5',          // per 'ai'
  tokens_in: 812,
  tokens_out: 94,
  tool_calls: [ /* se presenti */ ],
  citations: [ /* ref a artifact/esercizi */ ]
}
```

### `artifact_bodies`
Il corpo di un artifact — schema dipende dal `kind` dell'artifact su Postgres.

```js
// kind = 'simulation' (es. parabola viva)
{
  _id: 'art-parabola-viva',
  kind: 'simulation',
  schema_version: 1,
  params: {
    a: { min: -5, max: 5, default: -2, step: 0.1 },
    b: { min: -5, max: 5, default: 3,  step: 0.1 },
    c: { min: -5, max: 5, default: 1,  step: 0.1 }
  },
  view: { kind: 'function-plot', expression: 'a*x^2 + b*x + c', range_x: [-6, 6] }
}

// kind = 'concept-map'
{
  _id: 'art-rinascimento-mappa',
  kind: 'concept-map',
  schema_version: 1,
  center: { id: 'c', label: '1492' },
  nodes:  [ { id: 'n1', label: 'arte',    at: [20,22] }, … ],
  edges:  [ ['c','n1'], ['c','n2'], … ]
}
```

## Flussi chiave (cosa fa il backend tra un endpoint e l'altro)

### Chiudere una sessione → il curatore scrive
1. `POST /sessions/:id/close` (o trigger implicito quando `completed == total`).
2. Backend mette in coda `CuratorJob(session_id)` su BullMQ (Redis).
3. Worker: carica contesto (esercizi + attempts + messaggi AI) → chiama Anthropic con system prompt del curatore → scrive `curator_notebook` (Mongo) → estrae `resume_blurb`, `completion.outcome`, aggiorna `topic_nodes.state`.
4. `exactly-once` garantito da BullMQ + `unique jobs`: se il processo si riavvia a metà, il job non si duplica.

### Home studente
1. `GET /students/me/home` → un solo bundle.
2. Il backend joina Postgres (sessione paused più recente, attività visibili ora, completamenti recenti, nodi/archi costellazione, preview ultimo messaggio Chiara) + legge `narrative` da Mongo.

### Attività "preparato da Chiara"
1. Tutor crea un'attività via UI tutor (non ancora mockata sul frontend — ma già prevista come endpoint `POST /activities`).
2. Riga in `activities` con `scheduled_for = domattina alle 8`.
3. BullMQ schedula un job che la marca visibile a quell'ora (o più semplicemente, la query di home filtra per `scheduled_for <= now()`).

## Indici consigliati
Tutti quelli CREATE INDEX sopra + considerare:
- `GIN` su `activities.title` per ricerca testuale se servirà.
- `tsvector` su `completions.title + outcome` per archivio cercabile.
