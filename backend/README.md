# IphigenAI 2.0 — Backend

Fastify + TypeScript + PostgreSQL (Drizzle) + MongoDB + Redis (BullMQ) + Anthropic.

Due processi separati, dalla stessa codebase:

- **API server** (`src/index.ts`) — HTTP, auth, routes.
- **Worker** (`src/worker.ts`) — consuma la coda `curator` (BullMQ) e chiama Claude Opus a fine sessione.

## Struttura

```
backend/
├── src/
│   ├── index.ts              ← entry API
│   ├── worker.ts             ← entry worker
│   ├── app.ts                ← Fastify app builder
│   ├── config/env.ts         ← validazione env (zod)
│   ├── auth/                 ← JWT httpOnly cookie, argon2
│   ├── db/
│   │   ├── postgres.ts       ← Drizzle client
│   │   ├── mongo.ts          ← Mongo + collection typed
│   │   ├── redis.ts          ← ioredis (condiviso con BullMQ)
│   │   ├── migrate.ts        ← applica migration
│   │   ├── migrations/       ← generate con `npm run db:generate`
│   │   └── schema/           ← Drizzle schema per ogni tabella
│   ├── routes/               ← auth, students, sessions, ai-threads, threads, artifacts, admin
│   ├── services/             ← Anthropic: tutor-agent + curator + system prompts
│   ├── queues/curator.ts     ← queue BullMQ
│   ├── workers/curator-worker.ts
│   ├── seed/run.ts           ← popola con i dati demo (stesso seed del frontend)
│   └── lib/                  ← errors, ids
├── Dockerfile
├── docker-compose.dev.yml    ← Postgres + Mongo + Redis per lo sviluppo locale
├── railway.json              ← service API
├── railway.worker.json       ← service Worker
└── .env.example
```

## Sviluppo locale

```bash
# 1. servizi (Postgres + Mongo + Redis)
docker compose -f docker-compose.dev.yml up -d

# 2. config
cp .env.example .env
# → metti un JWT_SECRET random e la tua ANTHROPIC_API_KEY

# 3. dipendenze + migration + seed
npm install
npm run db:generate       # crea i file SQL in src/db/migrations (la prima volta)
npm run db:migrate        # applica lo schema
npm run seed              # popola utenti luca/chiara/admin + tutti i dati demo

# 4. due processi, in due terminali
npm run dev:api           # → http://localhost:3000
npm run dev:worker        # (ascolta la coda curator)
```

### Credenziali demo (post-seed)

| username | password     | ruolo    |
|----------|--------------|----------|
| `luca`   | `luca2026`   | studente |
| `chiara` | `chiara2026` | tutor    |
| `admin`  | `admin2026`  | admin    |

### Test rapido

```bash
# health
curl -i http://localhost:3000/health

# login (salva il cookie in jar.txt)
curl -i -c jar.txt -H 'Content-Type: application/json' \
  -d '{"username":"luca","password":"luca2026"}' \
  http://localhost:3000/api/auth/login

# home studente (usa il cookie)
curl -b jar.txt http://localhost:3000/api/students/me/home
```

## Deploy su Railway

Il repo contiene **un solo Dockerfile** ma **due config Railway** per creare due servizi dallo stesso codice:

1. **Crea un progetto Railway** collegato al repo GitHub (cartella `backend/` come root del servizio).
2. **Aggiungi i plugin dati** dallo store Railway:
   - `PostgreSQL` → variabile iniettata: `DATABASE_URL`.
   - `Redis` → variabile iniettata: `REDIS_URL`.
   - `MongoDB` (template community) **oppure** usa MongoDB Atlas free tier → setta `MONGO_URL` e `MONGO_DB` a mano.
3. **Crea il servizio API**:
   - Root dir: `backend/`
   - Config: `railway.json` (lascia quello di default)
   - Variabili: tutte quelle in `.env.example` (`JWT_SECRET`, `ANTHROPIC_API_KEY`, `FRONTEND_ORIGIN`, `COOKIE_SECURE=true`, `COOKIE_DOMAIN` eventuale). `PORT` la setta Railway.
4. **Crea il servizio Worker** (stesso repo, stesso branch):
   - Root dir: `backend/`
   - Config file: `railway.worker.json` (override via Railway settings → "Config as code")
   - Variabili: stesse del servizio API (stesso Postgres, stesso Mongo, stesso Redis).
5. **Prima deploy**: dopo il primo deploy API, dal locale o da `railway run` esegui:
   ```bash
   railway run --service=api npm run db:migrate
   railway run --service=api npm run seed
   ```
   (oppure aggiungi uno step `releaseCommand` in `railway.json` quando avremo migration stabili).

### Dominio

Railway assegna un URL tipo `https://iphigenai-api-production.up.railway.app`. Collegare il dominio custom (es. `api.iphigenai.it`) dalle impostazioni del servizio.

## Contratto API

Vedi [`project/docs/API.md`](../project/docs/API.md) — i contratti sono identici a quelli che il mock client del frontend espone.

Differenza rispetto al mock:
- **Auth in cookie httpOnly** (non Bearer token in localStorage).
  Lato frontend: `fetch(url, { credentials: 'include', ... })`.

## Scope attuale

Implementato (parità con il mock + admin base):

- [x] `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [x] `GET /api/students/me/home`
- [x] `GET /api/students/me/completed`
- [x] `GET /api/sessions/:id`, `POST /api/sessions/:id/answer`, `POST /api/sessions/:id/pause`
- [x] `GET /api/ai/threads/current`, `POST /api/ai/threads/:id/message` (Anthropic reale)
- [x] `GET /api/threads/:id`, `POST /api/threads/:id/message`
- [x] `GET /api/artifacts`, `GET /api/artifacts/:id`
- [x] `POST|GET|PUT|DELETE /api/admin/users`
- [x] Curator worker (BullMQ + Anthropic Claude Opus) — trigger automatico a fine sessione

Predisposto ma non implementato (hanno schema + tabelle, mancano endpoint):

- [ ] CRUD activities e scheduling BullMQ (job one-shot a timestamp)
- [ ] Tutor panel endpoints (timeline eventi, messaggi diretti, note private)
- [ ] Upload file (PDF, foto appunti) — servirà un bucket S3-compatible
- [ ] SSE streaming per la chat AI (ora POST sincrono)
- [ ] Costellazione: mutation dal tutor (ora solo lettura via home + aggiornamento dal curator)

## Troubleshooting

- **`JWT_SECRET deve essere almeno 32 caratteri`** → genera con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
- **CORS error sul browser** → verifica `FRONTEND_ORIGIN` in backend e `credentials: 'include'` lato frontend.
- **Cookie non salvato su prod** → in produzione HTTPS servono `COOKIE_SECURE=true` e `SameSite=None` (gestito automaticamente). Se frontend e backend sono su domini diversi, considera `COOKIE_DOMAIN=.iphigenai.it` per condividerlo.
- **Curator non parte** → verifica che il worker sia up (`npm run dev:worker`) e che `REDIS_URL` punti allo stesso Redis dell'API.
- **Anthropic 401** → `ANTHROPIC_API_KEY` mancante o invalida.
