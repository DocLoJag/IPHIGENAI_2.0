# IphigenAI 2.0 — Handoff

**Snapshot:** 2026-04-22
**Owner:** Loris (DocLoJag / lojagannath@gmail.com)
**Fase:** pilota in preparazione, nessuno studente ancora collegato.

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

### Cosa manca per far girare davvero il pilota

- [ ] Frontend migrato al backend vero (oggi usa `mock-client.js`, mai chiama l'API reale)
- [ ] Frontend in Next.js (ora è statico HTML/JSX da Claude Design) — optional per pilota, necessario per PWA installabile
- [ ] Tutor panel (admin è il flusso quotidiano di Chiara: riassunto post-lezione, creazione task, timeline eventi, note private)
- [ ] Scheduling attività automatiche (BullMQ job one-shot su `scheduled_for`)
- [ ] SSE streaming per la chat AI (ora POST sincrono, UX povera ma contratto identico al mock)
- [ ] Upload file (PDF, foto compiti, materiali esterni)

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
          ├── routes/                   ← auth, students, sessions, ai-threads, threads, artifacts, admin
          ├── services/                 ← anthropic client + tutor-agent + curator + system prompts
          ├── queues/curator.ts         ← BullMQ queue
          ├── workers/curator-worker.ts
          ├── seed/run.ts
          └── lib/                      ← errors + ids
  ```

### Storia commit

```
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

### 8.1 Tranche successiva (prossima da aprire): frontend al backend vero

> **Stato:** backend verificato end-to-end il 2026-04-22 — login `luca/luca2026` e bundle `/api/students/me/home` rispondono correttamente contro Railway. Questa è la tranche da aprire come prima cosa nella prossima conversazione.

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

Niente di questo è implementato. Molte tabelle sono predisposte ma servono endpoint nuovi + UI.

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
7. Se il primo passo (migrate + seed) non è stato ancora fatto, parti da lì (§7).

Non rifare ciò che è già fatto in §2. Non rimettere in discussione le decisioni chiave in §6 senza buon motivo.

Buon lavoro.
