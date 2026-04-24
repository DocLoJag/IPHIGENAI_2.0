# IphigenAI 2.0 — Handoff

**Snapshot:** 2026-04-24
**Owner:** Loris (DocLoJag / lojagannath@gmail.com) — **non sa programmare**: può verificare solo dal browser/UI. Tutta la parte tecnica (implementazione, git workflow, deploy, test E2E via curl) va portata end-to-end dall'agente. Non chiedere al owner scelte su merge/PR/push: scegli secondo il pattern del repo (push diretto su main) e procedi.
**Fase:** pilota in preparazione, nessuno studente ancora collegato. **Tranche §8.1 (frontend ↔ backend reale) completata. Tranche §8.3-READ (tutor panel backend read-only) completata. Tranche §8.3-WRITE sotto-tranche 2 (tutor panel backend — activities CRUD) completata. Tranche §8.3-WRITE sotto-tranche 3 (tutor panel backend — note private tutor) completata. Tranche §8.3-AI-PROPOSE sotto-tranche 1 (tutor panel backend — proposte task: schema + API tutor approve/reject) completata. Tranche §10-CLEANUP (fix globale ZodError + wipe completo + split routes/tutor) completata.**

Questo documento serve a far ripartire un agente o una persona da zero sapendo esattamente dove siamo. Leggilo top-to-bottom — poi se vuoi lo schema di dettaglio passa a `IPHIGENAI_2_0_VISIONE.md` e `project/docs/`.

---

## 1. Cos'è IphigenAI 2.0

Strumento che prolunga il rapporto tutor umano ↔ studente quando non sono in lezione. L'agente IA è l'assistente di bottega, non il prodotto. Visione completa in `IPHIGENAI_2_0_VISIONE.md` (v0.4).

Punti non negoziabili:
- Il centro è la **relazione**, l'AI è un moltiplicatore.
- Un solo agente per lo studente (niente più tre tutor per materia come nella 1.0).
- Il **curatore della memoria** a fine sessione aggiorna memoria strutturata + taccuino narrativo.
- Task come oggetto di prima classe (card editoriali nel feed).
- Cassetta degli attrezzi come archivio + vocabolario riusabile.
- Homepage come feed editoriale (non dashboard).
- Account creati solo dall'admin — nessuna registrazione pubblica.

---

## 2. Stato attuale

### Cosa c'è di fatto

- [x] Visione v0.4 consolidata
- [x] Frontend mock statico in `project/` (HTML + React via CDN) con contratti API e mock-client
- [x] Backend Fastify + TS completo, deployato su Railway
- [x] Endpoint paritari al mock + admin/users CRUD
- [x] Auth JWT in cookie httpOnly (argon2id per password)
- [x] Integrazione Anthropic: Claude Sonnet per tutor-agent, Claude Opus per curator
- [x] BullMQ worker separato, curator idempotente (jobId=sessionId)
- [x] Seed backend identico a `project/data/seed.js`
- [x] Repo GitHub online, monorepo
- [x] 5 servizi Railway online: API, Worker, Postgres, Redis, MongoDB
- [x] Build Docker passa su entrambi i servizi
- [x] **Schema Postgres applicato + seed su Railway** (2026-04-22, commit `d8287a7`). Migrate gira automaticamente a ogni deploy via `preDeployCommand` in `backend/railway.json`. Seed lanciato una tantum dal PC del dev via URL pubbliche temporanee.
- [x] Login `luca/luca2026` e bundle `/api/students/me/home` verificati end-to-end contro API Railway.
- [x] **Frontend parla al backend reale** (2026-04-22, commit `b715497`). `project/data/api-client.js` sostituisce `mock-client.js`: fetch con `credentials:'include'`, stessa superficie di API del mock (`window.api`, `window.useApi`). Nessun `localStorage`: sessione solo nel cookie httpOnly. Frontend può essere servito localmente (es. `npx serve project -l 5173`) e dialoga con l'API Railway di produzione.
- [x] **CORS allowlist** (commit `b715497`). Backend accetta ora più origin via env `CORS_ALLOWED_ORIGINS` (CSV), oltre a `FRONTEND_ORIGIN`. No wildcard (incompatibile con `credentials:true`).
- [x] **Bug curator jobId fixato** (commit `f1a24f8`): BullMQ 5 non accetta `:` nei custom jobId — causava 500 su `POST /sessions/:id/answer`. Separatore passato a `-`.
- [x] **Hero null-safe + click card feed funzionante + admin reset-demo** (commit `9c1732d`):
  - Homepage gestisce il caso `current_session: null` con placeholder editoriale.
  - Click su una card "Cosa ti aspetta" naviga alla sessione linkata (`linked_session_id`).
  - Nuova rotta `POST /api/admin/reset-demo` (requireRole admin) che chiama `seedDemo()`: distruttiva, utile per rimettere lo stato pilota al seed dopo una demo.
- [x] Verifiche E2E manuali (browser + curl): login, home, sessione, quiz answer, chat AI, chat Chiara, cassetta, archivio, logout, reset admin.
- [x] **Tutor panel backend read-only** (2026-04-23, commit `f81ce22`). Prima sotto-tranche di §8.3, puramente additiva. Nuovo file `backend/src/routes/tutor.ts` con 3 endpoint protetti da `requireRole('tutor')` + ownership check su `students.tutorId`:
  - `GET /api/tutor/students` — lista studenti assegnati al tutor loggato (con hint ultima sessione)
  - `GET /api/tutor/students/:id/overview` — bundle panoramica studente (info + ultime 10 sessioni + 10 attività upcoming + 10 completamenti + ultima nota curator)
  - `GET /api/tutor/students/:id/notebook?limit=` — storico note curator paginato
  - Verifiche E2E: login chiara→200, lista→ritorna Luca, overview→bundle corretto, notebook→200 (0 note è atteso: curator scrive solo su sessioni chiuse), studente inesistente→404, admin che tenta→403, regressione home studente→200.
- [x] **Tutor panel backend write — note private tutor** (2026-04-24, commit `3364032`). Sotto-tranche 3 di §8.3-WRITE. **Prima migration aggiuntiva del progetto**: `0001_watery_secret_warriors.sql` crea tabella `tutor_notes` (id, student_id FK users, tutor_id FK users, body, created_at, updated_at, indici `(student_id, created_at)` e `(tutor_id, student_id)`). Additiva, zero modifiche a tabelle esistenti, idempotente via `preDeployCommand` Railway. Quattro endpoint sotto `requireRole('tutor')`:
  - `POST   /api/tutor/students/:id/notes` → crea nota (ownership: `assertTutorOwnsStudent`), ritorna 201.
  - `GET    /api/tutor/students/:id/notes?limit=` → lista paginata (default 20, max 100), ordine DESC per `created_at`. Filtra `tutor_id = current`: note private dell'autore, altri tutor che avessero in futuro lo stesso studente non vedono le note del collega.
  - `PATCH  /api/tutor/notes/:id` → aggiorna `body` e `updated_at`, consentito solo all'autore via `assertTutorOwnsNote`.
  - `DELETE /api/tutor/notes/:id` → **hard delete** (sono appunti personali del tutor, non oggetti editoriali come activities che hanno soft-delete). Ritorna `{ok:true}` 200, oppure 404 se nota inesistente.
  - Validazione zod `.strict()` via helper `parseBody` (stesso workaround ZodError delle rotte activities).
  - Verifiche E2E contro Railway (32 casi): happy path completo (POST x3, GET lista+limit, PATCH con controllo updated_at > created_at, DELETE con 404 sul secondo tentativo); auth (luca→403, admin→403, senza cookie→401); validation (body vuoto→400, body mancante→400, campo extra→400 strict, body tipo sbagliato→400 sia POST che PATCH); 404 (studente fantasma, nota inesistente); regressione (GET /tutor/students, /overview, /notebook, home studente tutti 200). Stato demo ripulito con `/admin/reset-demo` dopo i test.
- [x] **Pulizia pre-curator — errorHandler, wipe, split tutor** (2026-04-24, commit `6ddac6b`). Tre micro-tranche di manutenzione impacchettate insieme per abbassare la barriera alla prossima sotto-tranche:
  - **ZodError globale risolto**. In `backend/src/app.ts` il `setErrorHandler` è stato spostato **prima** del register del sub-plugin `/api`. Fastify incapsula lo scope del figlio al momento del register: setErrorHandler chiamati dopo sul padre non raggiungono il figlio. Ora un body zod invalido in **qualsiasi** rotta ritorna 400 `VALIDATION`, non più 500 col dump degli issues. Rimosso il workaround locale `parseBody()` da tutte le rotte tutor; tornate a `schema.parse()` diretto, come nel resto del codebase. La gotcha in §10 è archiviata.
  - **Seed wipe completo**. `tutor_notes` aggiunto al TRUNCATE di `seedDemo()`: un `/admin/reset-demo` ora ripulisce davvero, senza lasciare note private del run precedente. Verificato E2E: create nota → reset → `total:0`.
  - **Split `routes/tutor.ts`** (767 righe → cartella di 7 file):
    ```
    backend/src/routes/tutor/
    ├── guards.ts        — asserts ownership (student/note/activity/proposal)
    │                     + assertSessionBelongsToStudent + activityKindSchema
    ├── serializers.ts   — serializeTutorActivity/Note/Proposal/CuratorNote
    ├── students.ts      — GET students, overview, notebook
    ├── activities.ts    — POST/PATCH/DELETE activities
    ├── notes.ts         — CRUD note private
    ├── proposals.ts     — list/approve/reject proposals
    └── index.ts         — registra i 4 sub-router
    ```
    Zero cambi di comportamento. `app.ts` ora importa `./routes/tutor/index.js`. Verificato E2E contro Railway: 3 login fresh, regressione su 7 GET endpoints, 4 POST write path, 4 validation strict, 9 auth (luca/admin/no-cookie su 3 path), 1 home studente. Tutto verde.
- [x] **Tutor panel backend write — proposte task (§8.3-AI-PROPOSE sotto-tranche 1)** (2026-04-24, commit `e862e33`). **Seconda migration aggiuntiva**: `0002_dapper_the_stranger.sql` crea enum `proposal_status` (`pending`/`approved`/`rejected`) e tabella `activity_proposals` (17 colonne, 4 FK verso `users`/`sessions`/`activities`, 2 indici). Additiva, zero modifiche a tabelle esistenti. Quattro endpoint in `backend/src/routes/tutor.ts` sotto `requireRole('tutor')` + ownership helper `assertTutorOwnsProposal`:
  - `GET  /api/tutor/proposals?status=&limit=` → coda globale del tutor (join via studenti assegnati); senza proposte ritorna `{items:[],total:0}`.
  - `GET  /api/tutor/students/:id/proposals?status=&limit=` → proposte per singolo studente.
  - `POST /api/tutor/proposals/:id/approve` → crea `activity` (con `preparedBy=tutor`, `preparedAt=now()`) copiando i campi dalla proposta; il body opzionale `.strict()` permette di sovrascrivere `kind`, `subject`, `title`, `kicker`, `estimated_minutes`, `priority`, `scheduled_for`, `linked_session_id`. Segna la proposta `approved`, popola `decided_at`/`decided_by`/`created_activity_id`. Ritorna `{proposal, activity}` 201. Se la proposta è già decisa → 400 `ALREADY_DECIDED`.
  - `POST /api/tutor/proposals/:id/reject` → segna `rejected` con `rejection_reason` opzionale. Stesso guard `ALREADY_DECIDED`.
  - Ordine dei controlli in approve/reject: ownership (404/403) → stato (400 `ALREADY_DECIDED`) → validation body (400 `VALIDATION`).
  - Seed: 3 proposte demo `pending` per Luca (`prop-seed-delta-recap`, `prop-seed-promessi-cap5`, `prop-seed-logica-insiemi`). `TRUNCATE` del wipe esteso a includere `activity_proposals` (prima di `activities` per evitare FK). Nota: `tutor_notes` resta fuori dal wipe (bug pre-esistente della sotto-tranche 3, fuori scope).
  - Miglioramento collaterale in `tutor.ts`: firma `parseBody` ristretta da `z.ZodType<T>` a `<S extends z.ZodTypeAny>` + `z.infer<S>` perché altrimenti i default di zod (es. `limit=20`) venivano persi nel tipo di ritorno (TS2345). Fix trasparente per tutte le chiamate esistenti.
  - Verifiche E2E contro Railway (31 casi): happy path (list globale, filtro per status/limit, list per studente, approve no-override → 201, approve con override priority+scheduled+estimated → 201, reject con reason → 200), 400 `ALREADY_DECIDED` su riapprove/rireject, 404 proposta/studente fantasma, auth (luca→403, admin→403, senza cookie→401), validation strict (body campo extra, tipo sbagliato, query `status=wrong`, `limit=0`), `linked_session_id` fantasma → 400 `LINKED_SESSION_NOT_FOUND`, regressione (home luca, /tutor/students, /overview, /notebook, /notes), e **integration test**: activity creata da approve compare in `upcoming` della home studente. Stato demo ripulito con `/admin/reset-demo` dopo i test.
- [x] **Tutor panel backend write — activities CRUD** (2026-04-24, commit `1701cc0` + fix `1421e42`). Sotto-tranche 2 di §8.3-WRITE, additiva al file `backend/src/routes/tutor.ts` (zero modifiche allo schema DB). Tre endpoint sotto lo stesso guard `requireRole('tutor')` + ownership via helper `assertTutorOwnsActivity`:
  - `POST /api/tutor/students/:id/activities` → crea un task per lo studente (imposta `preparedBy=tutor`, `preparedAt=now()`), ritorna 201.
  - `PATCH /api/tutor/activities/:id` → modifica campi editoriali (kind, subject, title, kicker, estimated_minutes, priority, scheduled_for, linked_session_id) e consente ripristino di un task scartato via `{"dismissed_at": null}`. `preparedBy`/`preparedAt`/`studentId`/`completedAt` immutabili dal client.
  - `DELETE /api/tutor/activities/:id` → soft-delete via `dismissedAt=now()`.
  - Validazione zod `.strict()` su entrambi i body. `linked_session_id`, se fornito, deve puntare a una sessione dello stesso studente (blocca cross-student).
  - Verifiche E2E contro Railway (17 casi): happy path (POST→201, PATCH→200, DELETE→200 con dismissed_at, PATCH dismissed_at:null→ripristino), auth (luca→403, admin→403), kind invalido→400 VALIDATION, linked_session inesistente→400, studente fantasma→404, activity inesistente→404, campo extra nel body→400 (strict), PATCH body vuoto→200 no-op, regressione home studente→200. Stato demo ripulito con `/admin/reset-demo` dopo i test.
  - Nota storica: al momento dell'implementazione c'era un bug per cui l'errorHandler globale non intercettava ZodError; è stato usato un helper locale `parseBody()` come workaround. **Risolto il 2026-04-24 nel commit `6ddac6b`** (vedi §10) e il workaround è stato rimosso.

### Cosa manca per far girare davvero il pilota

- [ ] Frontend in Next.js (ora è statico HTML/JSX da Claude Design) — optional per pilota, necessario per PWA installabile
- [ ] Tutor panel WRITE — activities CRUD (fatto), note private (fatto), approve/reject proposte (fatto). Manca: curator genera le proposte a fine sessione (§8.3-AI-PROPOSE sotto-tranche 2).
- [ ] Tutor panel UI (una sezione frontend dedicata al ruolo tutor: oggi Chiara entra dall'API ma non ha UI — il frontend mock mostra solo il lato studente)
- [ ] Scheduling attività automatiche (BullMQ job one-shot su `scheduled_for`)
- [ ] SSE streaming per la chat AI (ora POST sincrono, UX povera ma contratto identico al mock)
- [ ] Upload file (PDF, foto compiti, materiali esterni)
- [ ] Frontend deployato su un dominio pubblico (oggi gira solo in locale per dev)

---

## 3. Repo

- **GitHub:** https://github.com/DocLoJag/IPHIGENAI_2.0
- **Branch principale:** `main`
- **Monorepo** (decisione presa: un solo repo, non due separati):
  ```
  IPHIGENAI_2.0/
  ├── IPHIGENAI_2_0_VISIONE.md         ← visione v0.4
  ├── HANDOFF.md                        ← questo file
  ├── README.md                         ← handoff Claude Design (obsoleto, non aggiornato)
  ├── .gitignore
  ├── project/                          ← frontend mock
  │   ├── index.html                    ← entry navigabile
  │   ├── app.css / wireframes.css
  │   ├── app/                          ← router, components, pages
  │   ├── data/mock-client.js           ← da sostituire con api-client reale
  │   ├── data/seed.js                  ← dati demo
  │   └── docs/
  │       ├── API.md                    ← contratto API (autoritativo)
  │       ├── DATA_MODEL.md             ← schemi DB
  │       └── BACKEND_HANDOFF.md        ← contesto dal design
  └── backend/                          ← nuovo backend Fastify
      ├── README.md                     ← guida operativa backend
      ├── Dockerfile                    ← multi-stage, node:20-alpine
      ├── docker-compose.dev.yml        ← Postgres+Mongo+Redis per dev locale
      ├── railway.json                  ← config service API
      ├── railway.worker.json           ← config service Worker
      ├── .env.example
      ├── drizzle.config.ts
      └── src/
          ├── index.ts                  ← entry API
          ├── worker.ts                 ← entry Worker (processo separato)
          ├── app.ts                    ← Fastify builder
          ├── config/env.ts             ← validazione env con zod
          ├── auth/                     ← JWT cookie plugin + argon2
          ├── db/
          │   ├── schema.ts             ← schema Drizzle FILE UNICO
          │   ├── migrations/           ← generate con drizzle-kit
          │   ├── postgres.ts / mongo.ts / redis.ts
          │   └── migrate.ts
          ├── routes/
          │   ├── auth.ts, students.ts, sessions.ts
          │   ├── ai-threads.ts, threads.ts, artifacts.ts, admin.ts
          │   └── tutor/                ← sotto-dominio tutor panel (split 2026-04-24)
          │       ├── index.ts          — entry, registra i 4 sub-router
          │       ├── guards.ts         — asserts ownership + zod kind
          │       ├── serializers.ts    — serializer "per tutor"
          │       ├── students.ts       — GET students, overview, notebook
          │       ├── activities.ts     — POST/PATCH/DELETE activities
          │       ├── notes.ts          — CRUD note private
          │       └── proposals.ts      — list/approve/reject proposals
          ├── services/                 ← anthropic client + tutor-agent + curator + system prompts
          ├── queues/curator.ts         ← BullMQ queue
          ├── workers/curator-worker.ts
          ├── seed/run.ts
          └── lib/                      ← errors + ids
  ```

### Storia commit (ultimi a testa)

```
6ddac6b refactor(backend): pulizia pre-curator — errorHandler, wipe seed, split tutor
e862e33 feat(backend): tutor panel — proposte task §8.3-AI-PROPOSE sotto-tranche 1
3364032 feat(backend): tutor panel — endpoint write note private §8.3 sotto-tranche 3
1421e42 fix(backend): tutor write — body invalido ritorna 400 VALIDATION
1701cc0 feat(backend): tutor panel — endpoint write activities §8.3 sotto-tranche 2
f81ce22 feat(backend): tutor panel — endpoint read-only §8.3 sotto-tranche 1
9c1732d feat: card feed cliccabili + admin reset-demo per rimettere la demo
6c10fc5 fix(frontend): Hero gestisce current_session=null
f1a24f8 fix(backend): jobId curator senza ':' (BullMQ 5 lo rifiuta)
b715497 feat: frontend parla col backend reale (api-client + CORS allowlist)
e22c44b docs: §8.1 arricchita con dati operativi per la tranche frontend-backend
7d4d2c4 docs: HANDOFF — migrate+seed applicati su Railway, pilota verificato E2E
d8287a7 fix(backend): rinomino releaseCommand -> preDeployCommand (schema Railway)
9769ef9 chore(backend): applico migration Postgres automaticamente al deploy Railway
59d576a docs: HANDOFF.md — stato progetto per ripartenza
473e77b fix(backend): consolido schema Drizzle in file unico + genero migration iniziale
768437f fix(backend): errori TypeScript che bloccavano il build Docker
964d9ab Initial commit: visione, frontend mock, backend Fastify
```

---

## 4. Deploy Railway

- **Project Railway**: creato dal user, collegato al repo GitHub
- **Environment**: `production` (unico)
- **Servizi (5 online, stato `Online` confermato):**
  | Servizio | Tipo | Note |
  |---|---|---|
  | `API` | GitHub repo | Root `backend/`, config `railway.json`, startCommand `node dist/index.js`, healthcheck `/health` |
  | `WORKER` | GitHub repo | Root `backend/`, config `railway.worker.json`, startCommand `node dist/worker.js` |
  | `Postgres-ZsQZ` | Plugin Railway | **Nome non standard** — usa `${{Postgres-ZsQZ.DATABASE_URL}}` nei riferimenti |
  | `MongoDB` | Plugin Railway | Espone `MONGO_URL` (formato `mongodb://user:pass@mongodb.railway.internal:27017`, **senza** db name in fondo) |
  | `Redis` | Plugin Railway | Porta 6379 standard |

- **Build:** Docker, completa in ~2-3 minuti a deploy (argon2 + TS compile).
- **Ultima verifica connettività (network flow logs API):** traffico TCP confermato verso `:6379` (Redis) e `:27017` (MongoDB). Postgres non ancora in traffico perché `postgres-js` è lazy e nessuna query è partita.

### 4.1 Variabili d'ambiente (Shared a livello environment)

Le variabili sono condivise tra API e Worker via Shared Variables. Valori attuali in Railway:

| Variabile | Valore | Note |
|---|---|---|
| `JWT_SECRET` | `c973c99f8f157ca6fda9cfe17b1ba727cea7f5110f09b2ba6b89baaa7d8fab68e284c28f8a87f2043af17e1654ddb7adb13fdc3f389e81ab156fe8f3d3175007` | 128 char hex, generato `crypto.randomBytes(64)` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | chiave Anthropic del user |
| `ANTHROPIC_MODEL_TUTOR` | `claude-sonnet-4-5` | |
| `ANTHROPIC_MODEL_CURATOR` | `claude-opus-4-5` | |
| `COOKIE_SECURE` | `true` | obbligatorio su HTTPS di Railway |
| `FRONTEND_ORIGIN` | `https://chat.iphigenai.com` (placeholder) | **DA RIVEDERE** quando il frontend 2.0 verrà deployato — non può puntare al dominio della 1.0 che ospita LibreChat |
| `DATABASE_URL` | URL letterale o `${{Postgres-ZsQZ.DATABASE_URL}}` | user ha messo valore letterale |
| `REDIS_URL` | URL letterale o `${{Redis.REDIS_URL}}` | idem |
| `MONGO_URL` | `mongodb://mongo:.../mongodb.railway.internal:27017` | **manca il db name** — vedi sotto |
| `MONGO_DB` | `iphigenai` | **verificare che sia stato settato** — il codice fa `client.db(env.MONGO_DB)` separatamente |
| `CORS_ALLOWED_ORIGINS` | CSV di origin extra, oggi `http://localhost:5173` | Usata in `src/app.ts` per allowlist multipla (oltre a `FRONTEND_ORIGIN`). In dev locale permette al frontend su `http://localhost:5173` di parlare all'API Railway. **Rimuovere/sostituire** con dominio frontend definitivo quando deployato in produzione. |

Non vanno impostate (Railway/Dockerfile le gestisce): `PORT`, `NODE_ENV`.
Opzionali con default: `LOG_LEVEL` (default `info`), `JWT_EXPIRES_IN` (default `7d`), `COOKIE_DOMAIN` (vuoto, da usare solo se api+frontend su sottodomini dello stesso root).

### 4.2 Operativa

- Railway redeploya automaticamente a ogni push su `main`.
- Per forzare un redeploy: Deployments → `⋯` → Redeploy.
- Per eseguire comandi una-tantum (migrate, seed) vedi §7.

---

## 5. Credenziali demo (post-seed)

| Username | Password | Ruolo |
|----------|----------|-------|
| `luca`   | `luca2026`   | student (studente principale, tutto il seed è costruito su di lui) |
| `chiara` | `chiara2026` | tutor (di Luca) |
| `admin`  | `admin2026`  | admin |

Hash argon2id applicato dal seed.

---

## 6. Architettura — le decisioni chiave

1. **Stack**: Fastify 5 + TypeScript strict + Drizzle ORM + Postgres 16 + Mongo 7 + Redis 7 + BullMQ 5 + Anthropic SDK (Node).
2. **Auth**: JWT firmato in cookie **httpOnly** `iphigenai_session`. No Bearer in `Authorization` header, no token in `localStorage`. Il frontend deve fare `fetch(url, { credentials: 'include' })`.
3. **Schema Drizzle in file unico** (`src/db/schema.ts`). Originariamente era diviso per tabella ma drizzle-kit 0.30 non risolve gli import cross-file con estensione `.js` richiesta da NodeNext+ESM. Flattening è la soluzione stabile, si può tornare indietro solo quando drizzle-kit sistema la cosa.
4. **Due processi separati** dalla stessa codebase:
   - API (`src/index.ts`) espone HTTP
   - Worker (`src/worker.ts`) consuma la coda `curator` su Redis
   Motivazione: il curator usa Claude Opus con latenza alta — non bloccare la response HTTP dell'API.
5. **Modelli Anthropic differenziati**:
   - Tutor (conversazione studente): Sonnet — latenza bassa, costo contenuto
   - Curator (fine sessione, background): Opus — ragionamento più profondo, latenza non importa
6. **Curator exactly-once** via BullMQ con `jobId = curator:${sessionId}`. Se riparte a metà non duplica.
7. **Seed backend = seed frontend** 1:1. Dopo `npm run seed`, il backend risponde con gli stessi dati che il mock mostrava. Zero differenza visibile nel passaggio dal mock al backend vero.
8. **Mongo per dati non strutturati**:
   - `curator_notebook` → taccuino narrativo (body) + signals strutturati
   - `ai_messages` → messaggi thread AI (corpo dei messaggi; i thread stanno in Postgres)
   - `artifact_bodies` → corpi degli artifact (i metadati stanno in Postgres)
9. **System prompt composti lato backend**, mai esposti al client (`src/services/system-prompts.ts`). In una prossima tranche diventeranno editabili per studente.

---

## 7. Come proseguire — primo passo immediato

> ✅ **FATTO il 2026-04-22** — migrate automatico via `preDeployCommand`, seed eseguito una tantum con URL pubbliche temporanee. Bundle `/api/students/me/home` verificato end-to-end. Sezione mantenuta per riferimento storico; il prossimo passo operativo è ora §8.

**Bloccante (risolto)**: lo schema Postgres non era applicato e il DB era vuoto. Qualsiasi endpoint che toccava il DB falliva con `relation "users" does not exist`.

### 7.1 Opzione A — Railway CLI dal locale

```bash
# una volta sola
npm install -g @railway/cli
railway login
cd "<repo root>"
railway link    # seleziona workspace → project → environment
```

Poi:

```bash
railway run --service API npm --prefix backend run db:migrate
railway run --service API npm --prefix backend run seed
```

`railway run` inietta le env del servizio nello script locale.

**⚠️ Gotcha**: le URL `.railway.internal` che stanno nelle variabili funzionano SOLO dall'interno della rete Railway. `railway run` gira sul PC del dev, quindi serve la URL pubblica.

Due workaround:
- Temporanei: sostituire `DATABASE_URL`, `REDIS_URL`, `MONGO_URL` in shared con le URL pubbliche (senza `.railway.internal`), fare migrate/seed, poi ripristinare le private.
- Alternativa migliore: opzione B.

### 7.2 Opzione B — releaseCommand in railway.json

Aggiungere:
```json
{
  "deploy": {
    "releaseCommand": "npm run db:migrate",
    ...
  }
}
```

La migration gira dentro la rete Railway (URL private ok) a ogni deploy, prima che il servizio diventi "Live". Idempotente: drizzle-kit tiene traccia delle migration applicate in `__drizzle_migrations`.

Il **seed** invece non va in releaseCommand (riscriverebbe i dati a ogni deploy). Seed si fa una volta sola, ancora con `railway run` o con uno script manuale.

**Raccomandazione**: opzione B per migrate, opzione A per seed (una tantum).

### 7.3 Verifica funzionamento

Dopo migrate + seed:

```bash
# sostituisci <api-domain> con quello Railway (Settings → Domains del servizio API)

# 1) health
curl -i https://<api-domain>/health
# atteso: 200 {"ok":true,"now":"..."}

# 2) login (salva cookie in jar.txt)
curl -i -c jar.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"luca","password":"luca2026"}' \
  https://<api-domain>/api/auth/login
# atteso: 200 con Set-Cookie: iphigenai_session=...

# 3) bundle home
curl -b jar.txt https://<api-domain>/api/students/me/home
# atteso: JSON con user, current_session, upcoming (3), toolkit (3), completed_recent (3), constellation, chiara_thread_preview
```

---

## 8. Dopo la prima verifica — roadmap

### 8.1 Tranche COMPLETATA: frontend al backend vero ✅

> **Chiusa il 2026-04-22.** `project/data/api-client.js` sostituisce il mock, tutto il frontend parla con l'API Railway reale. Login, home, sessione, quiz, chat AI, chat Chiara, cassetta, archivio, reset admin: tutti verificati end-to-end. Il contenuto di questa sezione è mantenuto per riferimento storico sulle scelte.

**Dati operativi per attaccare la tranche:**

- **API base URL**: `https://api-production-21cc.up.railway.app`
- **Credenziali demo** (vedi §5): `luca/luca2026` (student), `chiara/chiara2026` (tutor), `admin/admin2026` (admin).
- **Contratto API autoritativo**: `project/docs/API.md`. Il mock in `project/data/mock-client.js` è la reference funzionale — il nuovo `api-client.js` deve esporre la stessa superficie (`window.api.login`, `window.api.getHome`, ecc.), così il resto del frontend non si tocca.
- **Compat contrattuale**: lo script `verify-home` funzionava sul mock. Lo stesso output è restituito dal backend. Quindi **nessuna modifica di shape** dovrebbe essere necessaria.

**Step concreti:**

1. Scrivere `project/data/api-client.js` che sostituisce `mock-client.js`:
   ```js
   const API_BASE = window.API_BASE || 'https://api-production-21cc.up.railway.app';
   async function request(method, path, body) {
     const res = await fetch(API_BASE + path, {
       method,
       credentials: 'include',
       headers: { 'Content-Type': 'application/json' },
       body: body ? JSON.stringify(body) : undefined,
     });
     const data = res.status === 204 ? null : await res.json().catch(() => null);
     if (!res.ok) throw { ...data, status: res.status };
     return data;
   }
   window.api = {
     login: (u, p) => request('POST', '/api/auth/login', { username: u, password: p }),
     logout: () => request('POST', '/api/auth/logout'),
     me: () => request('GET', '/api/auth/me'),
     getHome: () => request('GET', '/api/students/me/home'),
     // ... replicare la superficie di mock-client.js una-a-una
   };
   ```
2. In `project/index.html` sostituire `<script src="data/mock-client.js"></script>` con `<script src="data/api-client.js"></script>`.
3. Togliere il fallback a `localStorage` per l'auth (era del mock; il cookie httpOnly è gestito dal browser, non va letto/scritto da JS).
4. Testare in locale servendo `project/` con un dev-server HTTP locale (es. `npx serve project -l 5173`).

**⚠️ Gotcha cookie cross-origin in dev locale:**

Il cookie `iphigenai_session` è emesso con `Secure; SameSite=None; HttpOnly`. Questo ha due conseguenze in dev:

- **Secure** significa che il browser accetta il cookie SOLO se lo riceve su HTTPS e lo rinvia SOLO su HTTPS. Dato che l'API è HTTPS Railway, questo è OK anche se il frontend gira su `http://localhost:5173` — il cookie viaggia sulle richieste dal frontend all'API HTTPS.
- **CORS con credenziali**: `FRONTEND_ORIGIN` in Railway Variables del servizio API attualmente è `https://chat.iphigenai.com` (placeholder della 1.0, da rivedere comunque — vedi §9.1). Per dev locale va **aggiunto** l'origin del dev server (`http://localhost:5173`) alla config CORS. Verificare in `backend/src/app.ts` come è configurato `@fastify/cors`: se accetta una singola origin dall'env `FRONTEND_ORIGIN`, valutare di estendere a lista (array o funzione match) per accettare anche localhost in dev.

**Quando passare tutto in produzione**: definire il dominio frontend definitivo (§9.1), deployarlo come terzo servizio Railway o altrove, e settare `FRONTEND_ORIGIN` a quell'origin.

### 8.2 Porting a Next.js (§11.1 visione)

Obiettivo: PWA installabile, SSR dove serve, ecosistema componenti. Non urgente per pilota — il mock statico può reggere. Quando si fa, diventa un terzo servizio Railway (root directory `frontend/` o `app/`).

### 8.3 Tutor panel

Il flusso più importante descritto in §8 della visione:
- Riassunto post-lezione → genera task proposti → tutor approva/edita → entrano nel feed
- Timeline eventi per studente
- Note private
- Alert configurabili (silenzio prolungato, frustrazione, ecc.)
- Inserimento messaggi diretti
- Revisione prompt e profilo studente

**Stato:**
- [x] **§8.3-READ (2026-04-23)** — endpoint read-only per tutor: lista studenti assegnati, overview, storico note curator. Dettagli sopra in §2. File: `backend/src/routes/tutor.ts`. Zero UI ancora.
- [x] **§8.3-WRITE sotto-tranche 2 — activities CRUD (2026-04-24)** — `POST /api/tutor/students/:id/activities`, `PATCH /api/tutor/activities/:id`, `DELETE /api/tutor/activities/:id`. Nessuna nuova tabella. Verificato E2E contro Railway. Dettagli in §2. Zero UI ancora.
- [x] **§8.3-WRITE sotto-tranche 3 — note private tutor (2026-04-24)** — `POST /api/tutor/students/:id/notes`, `GET /api/tutor/students/:id/notes`, `PATCH /api/tutor/notes/:id`, `DELETE /api/tutor/notes/:id` (hard delete). Nuova tabella `tutor_notes` + migration `0001`. Note private all'autore. Verificato E2E (32 casi). Dettagli in §2. Zero UI ancora.
- [x] **§8.3-AI-PROPOSE sotto-tranche 1 — schema + API tutor approve/reject (2026-04-24)** — `GET /api/tutor/proposals`, `GET /api/tutor/students/:id/proposals`, `POST /api/tutor/proposals/:id/approve` (crea activity), `POST /api/tutor/proposals/:id/reject`. Nuova tabella `activity_proposals` + enum `proposal_status` + migration `0002`. Seed con 3 proposte `pending` demo. Verificato E2E (31 casi). Dettagli in §2. Zero UI ancora.
- [ ] **§8.3-AI-PROPOSE sotto-tranche 2 — curator genera proposte** — modifica al `CURATOR_SYSTEM_PROMPT` e a `runCuratorForSession()`: alla fine della nota il curator suggerisce 0-N proposte di task; le scriviamo in `activity_proposals` con status `pending` + `source_session_id`. Idempotenza: se esistono già proposte da quella sessione, skip. Dopo questa sotto-tranche il loop "fine lezione → proposta → feed" è chiuso lato backend.
- [ ] **§8.3-UI** — pagine/componenti frontend per il flusso di Chiara. Prerequisito: decidere se costruire dentro `project/` (HTML+React via CDN come oggi) o saltare direttamente al porting Next.js (§8.2).

### 8.4 Activity scheduling

Tabella `activities` ha `scheduled_for` e `dismissed_at`. Manca:
- endpoint `POST /activities` (creazione dal tutor)
- endpoint `PUT /activities/:id` (modifica, reschedule)
- endpoint `DELETE /activities/:id`
- job BullMQ one-shot che "attiva" l'activity al `scheduled_for`
- Oppure, più semplice: query di `GET /students/me/home` già filtra per `scheduled_for <= now()`, quindi basta l'inserimento, nessun job serve
- Notifica push PWA quando un'activity diventa visibile

### 8.5 SSE streaming chat AI

Sostituire `POST /ai/threads/:id/message` con un endpoint che restituisce `text/event-stream` e chunk incrementali. Richiede:
- Modifica backend: usare `anthropic.messages.stream()` invece di `.create()`, scrivere chunk sul response
- Modifica frontend: usare `EventSource` o fetch con ReadableStream invece di fetch sincrono
- Tenere il vecchio endpoint sync come fallback

---

## 9. Punti aperti (decisioni da prendere)

1. **Dominio definitivo del frontend pilota**. Opzioni: `pilot.iphigenai.com` / `2.iphigenai.com` / URL Railway auto. Serve per `FRONTEND_ORIGIN`, DNS, cookie domain.
2. ~~**Come applicare migrations**: opzione A, B, o C (job one-shot). Proposto B.~~ **Deciso 2026-04-22**: opzione B via `preDeployCommand: "node dist/db/migrate.js"` in `backend/railway.json`. Idempotente, gira prima del start.
3. **Hosting frontend**: Railway (terzo servizio) o altrove (Vercel, Cloudflare Pages)?
4. **Nome della sezione cassetta** (§6.7 visione): "cassetta degli attrezzi" vs "scaffale" vs "tavolo" vs "appunti". Rimandato.
5. **Nome dell'agente**: generico "il tutor" o nome proprio visibile allo studente?
6. **Modulo consenso parentale aggiornato** (§12 visione) — prima di introdurre studenti reali.

---

## 10. Gotchas documentate (per non rifarsi male)

- **drizzle-kit 0.30 + NodeNext**: gli import `.js` cross-file nei schema non si risolvono. Soluzione: schema in file unico. Se si torna a dividere per tabella, sicurezza con `drizzle-kit` 0.31+ e verificare.
- **ioredis 5 + NodeNext**: usare `import { Redis } from 'ioredis'`, non il default `import IORedis from 'ioredis'` — quello risolve al namespace module, non è constructable.
- **Fastify 5 setErrorHandler**: il parametro `err` è typizzato come `unknown`. Serve narrowing con `instanceof Error` prima di leggere `.message`.
- **Railway service-level vs shared variables**: service-level override shared. Se si spostano le variabili in shared, cancellare quelle di servizio.
- **Railway URL private**: `*.railway.internal` funziona solo dall'interno della rete Railway. Dal PC del dev serve la URL pubblica.
- **Railway variabili riferite**: `${{ServiceName.VAR}}` richiede il nome **esatto** del servizio (incluso il suffisso random che Railway aggiunge, es. `Postgres-ZsQZ`). Meglio usare il picker UI di Railway che il typing manuale.
- **Railway `preDeployCommand` vs `releaseCommand`**: su Railway la proprietà in `railway.json` per comandi che girano prima del start del servizio si chiama `preDeployCommand`. `releaseCommand` è nomenclatura Heroku e viene scartata silenziosamente dallo schema Railway (nessun errore nei log, il comando semplicemente non gira). Schema autoritativo: `backboard.railway.app/railway.schema.json`.
- **BullMQ 5 — custom jobId non accetta `:`**: se passi `{ jobId: 'foo:bar' }` a `queue.add()` ricevi `500 Custom Id cannot contain :`. Usare `-` o `_` come separatore. Si è manifestato in `src/queues/curator.ts` ed era il blocker di `POST /sessions/:id/answer`.
- **~~`err instanceof ZodError` nel setErrorHandler globale non matcha~~** — **RISOLTO il 2026-04-24 (commit `6ddac6b`)**. La causa reale: in Fastify 5 ogni `app.register(plugin)` crea uno scope incapsulato che **fotografa** gli handler del padre al momento del register. Se `setErrorHandler` viene chiamato DOPO il register del plugin che contiene le rotte, lo scope figlio non lo vede e gli errori ricadono sul default di Fastify (che non sa leggere ZodError → 500 col dump degli issues). Fix: spostare `setErrorHandler` (e `setNotFoundHandler`) **prima** di `await app.register(v1routes, { prefix: '/api' })` in `src/app.ts`. Rimosso di conseguenza il workaround `parseBody()` dalle rotte tutor: tutte tornate a `schema.parse()` diretto, come nel resto del codebase. Un body zod invalido su **qualsiasi** rotta (anche admin, students, sessions) ora ritorna 400 `VALIDATION` pulito. Verificato in produzione con `POST /api/admin/users {}`.
- **Chrome incognito blocca i cookie di terze parti di default**: se servi il frontend su `http://localhost:5173` e l'API è su un dominio diverso (Railway), in incognito il cookie di sessione viene scartato e il login sembra "non autorizzato". In modalità normale funziona. Sparirà quando frontend e API condivideranno lo stesso root domain. Non è un bug del backend.
- **Hero null-safe in Home**: `current_session: null` è uno stato legittimo (nessuna sessione attiva). Il componente `Hero` in `project/app/pages/Home.jsx` deve gestirlo — se si aggiungono nuovi componenti che leggono il bundle `/students/me/home`, controllare sempre i campi nullable.
- **CRLF warnings di Git su Windows**: ignorabili.
- **postgres-js è lazy**: non vedi traffico DB finché non parte la prima query.
- **MONGO_URL**: il formato Railway non include il db name in fondo. Il codice fa `client.db(env.MONGO_DB)` separatamente — `MONGO_DB=iphigenai` va settata a parte.
- **CORS con credenziali**: backend deve avere `credentials: true`, frontend deve fare fetch con `credentials: 'include'`, e `FRONTEND_ORIGIN` deve matchare ESATTAMENTE (protocollo + host + porta). No wildcard `*` possibile con credenziali.
- **Windows + bash/sed**: alcune operazioni di file hanno path Windows, usare forward slashes in comandi via Bash tool.

---

## 11. Comandi utili quick-reference

### Locale

```bash
# servizi
docker compose -f backend/docker-compose.dev.yml up -d
docker compose -f backend/docker-compose.dev.yml down

# backend dev
cd backend
cp .env.example .env       # configurare
npm install
npm run db:generate        # rigenera migrations dallo schema se cambi schema.ts
npm run db:migrate         # applica migrations al DB
npm run seed               # popola dati demo
npm run dev:api            # Fastify con hot-reload via tsx
npm run dev:worker         # worker con hot-reload
npm run typecheck          # tsc --noEmit

# build production
npm run build
npm run start:api
npm run start:worker
```

### Frontend in locale (dev con backend Railway)

```bash
# dalla root del repo
npx --yes serve project -l 5173 --no-clipboard
# apri http://localhost:5173 nel browser (NON incognito — vedi §10)
# login demo: luca/luca2026 | chiara/chiara2026 | admin/admin2026
```

Prerequisito: in Railway Shared Variables deve esistere `CORS_ALLOWED_ORIGINS=http://localhost:5173` (già settata).

### Reset demo via API (distruttivo)

Per rimettere lo stato al seed dopo una dimostrazione (ricreando sessione in pausa di Luca, cronologia Chiara, ecc.):

```bash
# 1) login come admin (salva cookie)
curl -c jar.txt -X POST https://api-production-21cc.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin2026"}'

# 2) reset
curl -b jar.txt -X POST https://api-production-21cc.up.railway.app/api/admin/reset-demo
# atteso: {"ok":true,"reset_at":"..."}
```

### Railway CLI

```bash
railway login
railway link
railway status
railway logs --service API
railway logs --service WORKER
railway run --service API npm --prefix backend run db:migrate
railway run --service API npm --prefix backend run seed
railway variables --service API
```

### Git

```bash
cd "<repo root>"
git status
git log --oneline -10
git push
# nuovo branch per feature
git checkout -b feat/<nome>
git push -u origin feat/<nome>
# poi gh pr create --title ... --body ...
```

---

## 12. Compliance stato attuale

Fase pilota, nessuno studente reale nel sistema. Pseudonimizzazione prevista (nomi finti dal tutor), consenso informato verbale + scritto dei genitori. Per il deploy generale mancano ancora DPIA, TIA, Privacy Policy aggiornata, diritti dell'interessato in UI. Rimandati coscientemente (§12 visione). Da sistemare prima di introdurre pagamenti.

---

## 13. Chi contattare

- **Loris** (owner, tutor principale): lojagannath@gmail.com, DocLoJag su GitHub.
- Il progetto è individuale in questa fase. Nessuna team structure.

---

## 14. Come ripartire una conversazione da zero

Se sei Claude (o un'altra persona) che deve continuare:

1. Leggi **questo file** in toto.
2. Leggi `IPHIGENAI_2_0_VISIONE.md` (è breve e denso, non saltarlo).
3. Apri `project/docs/API.md` e `project/docs/DATA_MODEL.md` per i contratti.
4. Verifica su GitHub che lo stato del repo sia ancora coerente col log commit in §3. Se ci sono commit più recenti, aggiornati dal diff.
5. Verifica su Railway che i 5 servizi siano ancora online e con le stesse variabili.
6. Chiedi al user quale tranche vuole aprire (vedi §8).

**Prossime tranche candidate** (in ordine di priorità strategica):
- **§8.3-AI-PROPOSE sotto-tranche 2** — curator genera le proposte a fine sessione (schema e API approve/reject già pronti in sotto-tranche 1). Chiude il loop "fine lezione → memoria → proposta → feed". Richiede: aggiornare `CURATOR_SYSTEM_PROMPT` per includere un campo `proposals` nel JSON di output; `runCuratorForSession` legge il campo e inserisce in `activity_proposals` con status `pending` + `source_session_id`. Idempotenza: skip se ci sono già proposte da quella sessione. Test: girare una sessione end-to-end (student POST `/sessions/:id/close`), verificare che le proposte compaiano in `GET /tutor/proposals`.
- **§8.5 SSE streaming chat AI** — UX della chat migliora, ma è cosmetica rispetto al tutor panel.
- **§8.4 Activity scheduling** — quando Chiara programma un task per "domani alle 18", il job lo renderà visibile al momento giusto.
- **§8.3-UI / §8.2 Porting a Next.js** — infrastrutturale, rimandabile.

Non rifare ciò che è già fatto in §2. Non rimettere in discussione le decisioni chiave in §6 senza buon motivo.

Buon lavoro.
