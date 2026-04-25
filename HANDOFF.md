# IphigenAI 2.0 — Handoff

**Snapshot:** 2026-04-25
**Owner:** Loris (DocLoJag / lojagannath@gmail.com) — **non sa programmare**: può verificare solo dal browser/UI. Tutta la parte tecnica (implementazione, git workflow, deploy, test E2E via curl) va portata end-to-end dall'agente. Non chiedere al owner scelte su merge/PR/push: scegli secondo il pattern del repo (push diretto su main) e procedi.
**Fase:** pilota in preparazione, nessuno studente ancora collegato. **Tranche §8.1 (frontend ↔ backend reale) completata. Tranche §8.3-READ (tutor panel backend read-only) completata. Tranche §8.3-WRITE sotto-tranche 2 (tutor panel backend — activities CRUD) completata. Tranche §8.3-WRITE sotto-tranche 3 (tutor panel backend — note private tutor) completata. Tranche §8.3-AI-PROPOSE sotto-tranche 1 (tutor panel backend — proposte task: schema + API tutor approve/reject) completata. Tranche §10-CLEANUP (fix globale ZodError + wipe completo + split routes/tutor) completata. Tranche §8.3-AI-PROPOSE sotto-tranche 2 (curator genera proposte a fine sessione) completata: il loop "fine lezione → memoria → proposta → feed" è chiuso lato backend. Tranche §10.2-CLEANUP (pulizia pre-§8.3-UI: 7 micro-fix da audit profondo) completata. Tranche §8.3-UI sotto-tranche 1 (frontend tutor panel: home con lista studenti, scheda studente, coda proposte, note private) completata: Chiara ha finalmente la sua UI nel browser, niente più solo curl. Tranche §8.3-UI sotto-tranche 2 + §8.4 (scheduling activity da UI tutor: form crea/modifica con `scheduled_for`, override fields in approve proposta) completata: il loop "tutor programma per X → studente lo vede al momento giusto" è chiuso end-to-end. Tranche §8.5 (chat tutor AI in streaming SSE: i token compaiono progressivamente nel browser invece del salto da vuoto a completo) completata: la UX della chat è finalmente quella attesa. Tranche §8.3-UI sotto-tranche 3a (UI ripristino activity scartate) completata: il tutor può rimettere in coda task scartati per errore senza ricrearli da zero. Tranche §8.6 sotto-tranche 1 (backend upload file: foto compiti, PDF) completata. Tranche §8.6 sotto-tranche 2 (UI upload, atterrata in due passaggi paralleli: paperclip nel composer chat AI + sezione Allegati nel pannello tutor da PR #5; pagina dedicata `/files` lato studente con voce in topbar + backend fix lista uploads incrociata da questa PR) completata. Tranche §8.3-UI sotto-tranche 3b parziale (UI admin minimale) completata: l'admin ora ha un suo pannello con lista utenti e bottone reset-demo, niente più 403 quando entra. Tranche §8.6 sotto-tranche 3 (integrazione AI: gli allegati passano come content block image/document ad Anthropic) completata: ora Sonnet 4.5 legge davvero la foto/PDF, non più solo l'URL nel testo.**

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
- [x] **Integrazione AI allegati — §8.6 sotto-tranche 3** (2026-04-25, PR #7). Chiude la pipeline upload→AI: lo studente allega una foto del compito e Sonnet 4.5 la *legge davvero*. Prima i workaround di st2 appendevano solo l'URL al testo; ora il binario viene caricato da GridFS e passato come content block `image` (immagini) o `document` (PDF) nell'array `messages` della Messages API.
  - **Backend** (`backend/`):
    - `db/mongo.ts` — `AiMessageDoc` ha un nuovo campo opzionale `attachment_ids?: string[]`. Persistito sui doc `ai_messages` in modo che la replay history dei turni successivi riesca a ricostruire i content block per i messaggi studente passati.
    - Nuovo `services/attachment-blocks.ts`. Tre funzioni: `loadAttachmentsForStudent(ids, studentId)` (validazione ownership con stessi guard di `assertCanAccessAttachment`: ownerId=self OR studentId=self; throw `notFound` o `forbidden`); `loadAttachmentsByIds(ids)` per la replay (filtra silenziosamente i soft-deleted, niente throw — un file cancellato a metà conversazione droppa il blocco senza rompere la chat); `gridfsToBase64(gridfsId)` (download intero blob in memoria, base64); `attachmentToContentBlock(att, base64)` (`image` per `image/{png,jpeg,webp,gif}`, `document` per `application/pdf`).
    - `services/tutor-agent.ts` esteso. `prepareTutorTurn(input)` accetta `attachmentIds?: string[]`, valida e persiste sul doc studente, poi nella replay history converte ogni user message con allegati in array di content block (testo come ultimo blocco se presente). Cache base64 locale al singolo turno per dedupe (un'immagine può apparire in più turni). Limite history a 40 messaggi resta come prima.
    - `routes/ai-threads.ts`. Body schema cambia: `text` ha `default('')`, nuovo campo `attachment_ids: z.array(z.string()).max(5).optional()`, `superRefine` impone almeno uno dei due non vuoto. Sia `POST /message` che `POST /message/stream` propagano `attachment_ids` a `prepareTutorTurn`. Il payload `meta` SSE include ora `attachments` serializzati nel blocco `student`. `GET /ai/threads/current` aggrega tutti gli `attachment_ids` referenziati nella history e li serializza una sola volta in batch.
    - `routes/serializers.ts` esteso con `serializeAttachment` (estratto da `routes/uploads.ts`, ora condiviso). Nuova funzione `serializeAiMessage(doc, threadId, attsById)` in `tutor-agent.ts` per produrre il payload uniforme client.
    - **SDK note**: `@anthropic-ai/sdk@0.32.1` espone `BetaBase64PDFBlock` solo nel namespace `beta.messages`. L'API standard `messages.create` accetta document block a runtime su Sonnet 4.5+ — fatto cast `as unknown as MessageParam[]` ai due call site (`runTutorTurn` + rotta SSE) con commento esplicativo. Quando l'SDK si aggiorna a una versione che ha document block nei tipi della rotta standard, il cast cade.
  - **Frontend** (`project/`):
    - `app/pages/AIChat.jsx` rimuove il workaround di st2 (append URL al testo) e ora invia `{ text, attachment_ids: [att.id] }` al body di `/message/stream` (e fallback `/message`). L'optimistic update include subito `m.attachments` con il SerializedAttachment fresco dal POST `/uploads`, così il thumbnail compare nella bolla studente prima ancora del primo `delta` SSE.
    - `app/components.jsx` — `ChatScreen` renderizza `m.attachments` come griglia sopra il testo della bolla. Nuovo componente `MessageAttachment`: per le immagini un `<img crossOrigin="use-credentials" width=88 height=88>` cliccabile (apre in nuova tab); per i PDF una chip con badge "PDF" + filename. Stesso pattern del componente `<AttachmentChipPreview>` del composer (gotcha cookie httpOnly cross-origin).
  - **Verifiche E2E** (browser preview locale `:5173` → API Railway, post-merge):
    - Upload PNG 240×80 con scritto "−2x² + 3x + 1 = 0" via `POST /uploads`, then `POST /ai/threads/.../message` con `attachment_ids` → 200, AI risponde "Vedo l'inizio di un'equazione: −2x² + 3x + 1 = … (manca il termine dopo l'uguale, probabilmente zero)". L'AI legge davvero il contenuto dell'immagine.
    - **Replay history**: turno successivo senza allegato, "Quale era il coefficiente di x²?" → AI risponde "Il coefficiente di x² è −2". La replay ricarica e ri-serve l'immagine come content block del turno precedente.
    - `GET /ai/threads/current` reload → la bolla studente con allegato torna con `attachments[]` popolato (1 elemento, mime+filename+url).
    - **PDF**: upload PDF minimo "Compito: risolvi 5+7" → AI risponde "C'è scritto 'Compito: risolvi 5+7'. Ma Luca, questo non è esattamente il tuo compito di matematica…". Document block funziona.
    - **Cross-ownership**: upload come admin senza `student_id`, login come Luca, tentativo di passare quell'ID nel `attachment_ids` → 403 FORBIDDEN "Allegato non accessibile" (validazione `loadAttachmentsForStudent`).
    - **SSE end-to-end** via `api.stream`: emessi `meta` (con `student.attachments` count=1), 5 `delta`, `done` (con messaggio AI finale). UI: thumbnail PNG `naturalWidth=240/240=88px display=block` + chip PDF `text="PDFcompito.pdf"` renderizzati sopra il testo nella bolla studente, 2 messaggi con allegati in DOM dopo reload.
  - **Cosa NON c'è in questa sotto-tranche** (per scope, valutare se servirà):
    - Cache LRU dei base64 cross-turno: oggi rilettura GridFS ad ogni turno. Per il pilota va bene, va valutata se i thread crescono di MB di immagini.
    - Strip allegati storici dalla replay (es. "solo gli ultimi 2 turni includono content block, gli altri solo text"): risparmierebbe token quando il thread diventa lungo. Da fare se i costi Anthropic salgono.
    - Allegati lato risposta AI: oggi l'AI può solo leggere, non genera/cita immagini. Fuori scope.
- [x] **UI upload file — §8.6 sotto-tranche 2a** (2026-04-25). Apre il file caricabile dal browser, dopo aver chiuso il backend in st1. Spezzata in 2a (upload + lista) e 2b (paperclip nella chat AI con persistenza `attachment_ids`) perché 2a è già una unità utile da sola: lo studente fotografa un compito e lo manda al tutor senza più dover passare da curl.
  - **Frontend** (additivo). Nuova pagina studente `/files` (`project/app/pages/Files.jsx`): topbar arricchita con "I miei file"; form upload (file picker + anteprima inline immagine via `URL.createObjectURL` + placeholder "PDF" per i PDF + size cap/MIME check client-side coerenti col backend); lista cronologica con thumbnail vera per le immagini (caricata cross-origin via `<img crossOrigin="use-credentials" src=…>` perché il backend è su Railway e il cookie è SameSite=None) e placeholder cliccabile per i PDF; click su una riga apre il binario in nuova tab; bottone elimina sui propri file (canDelete via `att.owner_id === user.id`).
  - **Frontend tutor** (additivo, stesso file). Componente riusabile `<window.AttachmentsBlock studentId currentUserId showToast />` montato in `pages/TutorStudent.jsx` tra "Scartati" e "Sessioni recenti". Form upload con `studentId` settato (lo studente lo vedrà nei suoi file); lista filtrata `?student_id=…`; bottone elimina solo sui file caricati dal tutor stesso (canDelete via stesso confronto).
  - **API client**: `api.uploadFile(file, {studentId})` in `data/api-client.js`. Multipart via `FormData` (NON settare `Content-Type` a mano: il browser deriva `multipart/form-data; boundary=…`). Convenzione `student_id` PRIMA del file part rispettata da `FormData.append()`.
  - **Backend fix collaterale** (`routes/uploads.ts`). `GET /api/uploads` per `role=student` ora include `(ownerId = self) OR (studentId = self)`, oltre al solo `ownerId = self` di prima. Coerente con `assertCanAccessAttachment` (che già autorizzava la lettura del singolo allegato in entrambi i casi) e con la copy della pagina ("le foto che hai caricato + quelli che ti ha mandato il tutor"). Prima la lista nascondeva i file caricati dal tutor "per Luca": Luca avrebbe avuto un id valido e una GET diretta funzionante ma nessun modo di scoprirlo. Bug latente di st1, fixato qui contestualmente. `or` aggiunto agli imports drizzle.
  - **Verifiche E2E** (browser preview locale `:5173` → API Railway, no curl):
    - Login Luca → `/files`: topbar mostra "I miei file" attiva, header/copy corretti, lista vuota.
    - Upload PNG 1.4 KB via `api.uploadFile` → 201 con `owner_id=student-luca`, `student_id=student-luca` (auto-derivato). Reload: 1 row con thumbnail vera (img caricata cross-origin con cookie, naturalWidth=64).
    - Upload PDF 299 B → 201, riga con placeholder "PDF" cliccabile.
    - DELETE owner Luca → `{ok:true}`, riga sparisce dalla lista al reload.
    - Login Chiara → scheda Luca → presente sezione "Allegati" tra "Scartati" e "Sessioni recenti". Lista mostra il PNG di Luca senza bottone elimina (ownerId mismatch).
    - Upload come Chiara con `studentId=student-luca` → 201 `owner_id=tutor-chiara`, `student_id=student-luca`. Reload: 2 file in lista, "elimina" presente solo su quello di Chiara.
    - Rilogin Luca → `/files`: 2 file (proprio + quello di Chiara). Fix backend verificato (prima erano 1).
    - `npm run typecheck` backend → verde.
  - **Cosa NON c'è in questa sotto-tranche** (per scope, rimandato):
    - Paperclip nel composer chat AI: richiede una modifica allo schema Mongo `ai_messages` per persistere `attachment_ids` e poi il render dell'allegato dentro la bolla del messaggio. È sotto-tranche 2b — è ben isolata e può essere fatta da sola.
    - Integrazione AI come `image`/`document` content block (Anthropic): sotto-tranche 3.
    - Cleanup batch dei blob GridFS soft-deleted (deferred da st1).
    - Decisione UX se il pulsante "Cassetta degli attrezzi" e "I miei file" debbano fondersi in futuro: oggi sono separati (artifact editoriali del sistema vs. file caricati dall'utente), distinzione mentale chiara per il pilota.
  - **Gotcha rilevata** (utile per i prossimi cross-origin asset): `<img>` cross-origin senza `crossOrigin="use-credentials"` non manda i cookie, quindi un endpoint protetto da auth darebbe 401 silenzioso (browser console pulita, immagine "broken"). La risposta deve includere ovviamente `Access-Control-Allow-Origin: <esatto>` (no wildcard) + `Access-Control-Allow-Credentials: true`, già forniti dal `@fastify/cors` allowlist+credentials. Salvato come pattern.

- [x] **Upload file — backend §8.6 sotto-tranche 1** (2026-04-25, commit `4a49519` su PR #3). Apre il primo gap reale lato pilota dopo la chiusura della chat AI streaming: lo studente fotografa un esercizio (o il tutor allega un PDF di consegna) e il file gira nel sistema. Solo backend in questa sotto-tranche; UI e integrazione AI vengono dopo.
  - **Storage**. Metadati su Postgres (nuova tabella `attachments`: id, owner_id, student_id nullable, filename, mime, size_bytes, gridfs_id, created_at, deleted_at, indici `(owner_id, created_at)` e `(student_id, created_at)`). Migration `0004_milky_vin_gonzales.sql` additiva. Binario su Mongo GridFS, bucket `attachments` (collezioni `attachments.files` + `attachments.chunks`). Decisione: niente S3/R2 per ora — Mongo già provisioned su Railway, zero nuovi servizi/credenziali, coerente con il pattern "Mongo per dati non strutturati" di §6.8.
  - **Endpoint additivi** in `backend/src/routes/uploads.ts`:
    - `POST /api/uploads` (multipart, auth richiesta) — accetta `file` + opzionale form field `student_id` (deve precedere il file part). Stream diretto in GridFS senza buffer in memoria. Validazione MIME (whitelist `image/png|jpeg|webp|gif`, `application/pdf`) + size 10 MB enforced via `@fastify/multipart` limits. Ritorna 201 con `{id, url, filename, mime, size_bytes, owner_id, student_id, created_at, deleted_at:null}`.
    - `GET /api/uploads/:id` — stream del binario, `Content-Type` dal mime salvato, `Content-Disposition: inline` (browser renderizza immagine/PDF), `Cache-Control: private, max-age=3600`.
    - `GET /api/uploads/:id/meta` — JSON dei soli metadati.
    - `GET /api/uploads?student_id=&limit=` — lista filtrata per ruolo: studente vede i propri (ownerId=self), tutor vede quelli del proprio studente (filtro `student_id` obbligatorio, altrimenti `[]` per non-rischiare cross-student), admin vede tutto. Esclude soft-deleted via `isNull(deletedAt)`.
    - `DELETE /api/uploads/:id` — soft-delete (`deletedAt=now()`), binario GridFS resta per audit/undelete (cleanup deferred). Solo owner o admin. Secondo DELETE → `{ok:true, already_deleted:true}`.
  - **Auth/ownership** (`assertCanAccessAttachment` in routes/uploads.ts):
    - admin → tutto.
    - owner → tutto sui propri file.
    - studente → i propri (ownerId=self) **+** quelli con `student_id=self` (così il tutor può "caricare per Luca" e Luca vede in `/uploads`).
    - tutor → quelli con `student_id` di un proprio studente; admin verifica via join `students.tutorId`.
    - DELETE: solo owner o admin (il tutor che ha accesso in lettura non cancella file altrui).
  - **Validazione student_id in upload** (`resolveStudentIdForUpload`): student può solo dichiarare se stesso (default deriva auto a `me.sub` se non passato); tutor deve possedere lo studente target (`students.tutorId === me.sub`) altrimenti 403; admin liberamente, ma lo studente deve esistere altrimenti 400 `STUDENT_NOT_FOUND`. Risoluzione fatta PRIMA dello stream a GridFS — niente blob orfani in caso di rifiuto.
  - **Wipe seed esteso** in `seedDemo()`: `attachments` aggiunto al TRUNCATE Postgres; `attachments.files` e `attachments.chunks` droppate da Mongo (try/catch su collezioni inesistenti). Verificato: dopo `reset-demo` la lista uploads di Luca è vuota.
  - **Nuova dipendenza**: `@fastify/multipart` ^10.0.0 (compatibile Fastify 5). Registrato in `app.ts` con `limits: { fileSize: 10 MB, files: 1, fields: 4 }`.
  - **Verifiche E2E** contro Railway (20 casi, dopo merge + redeploy):
    - Happy path: PNG 68 byte e PDF 212 byte caricati come Luca (studente) → 201 con `student_id` auto-derivato a `student-luca`. GET binario → byte-by-byte match con l'originale (`cmp`); `Content-Type` corretto. GET meta → JSON identico al body del POST.
    - Validation: `Content-Type: application/json` → 400 `NOT_MULTIPART`; file `text/plain` → 400 `MIME_NOT_ALLOWED`; multipart con solo `student_id` (no file) → 400 `FILE_MISSING`; file 11 MB con MIME `image/png` → 400 `FILE_TOO_LARGE` (multipart limits enforce); senza cookie → 401 `AUTH_REQUIRED`.
    - Cross-role: Chiara (tutor) carica per `student-luca` → 201 con `owner_id=tutor-chiara`, `student_id=student-luca`. Chiara legge file di Luca → 200 (ownership tutor→student). Chiara DELETE file di Luca → 403 (`Solo l'autore può cancellare`). Chiara con `student_id=student-fake` → 400 `STUDENT_NOT_FOUND`. Chiara senza `student_id` → 201 con `student_id=null` (file "personale" del tutor, non legato a uno studente).
    - Lista: lista uploads Luca → 2 file (i suoi). Lista chiara senza `student_id` → `{items:[],total:0}`. Lista chiara con `student_id=student-luca` → 3 file (incluso quello caricato da lei per Luca).
    - Soft-delete: DELETE owner Luca → `{ok:true}`; secondo DELETE → `{ok:true, already_deleted:true}`; GET dopo soft-delete → 404 (sia binario sia meta); GET id fantasma → 404.
    - Visibilità incrociata: Luca legge file caricato da Chiara per lui (student_id=luca) → 200. Luca tenta GET file privato di Chiara (student_id=null) → 403.
    - Regressione: `/health`, `/api/students/me/home`, `/api/tutor/students`, `/api/tutor/students/student-luca/overview` tutti 200 dopo `reset-demo`.
  - **Cosa NON c'è in questa sotto-tranche** (per scope): UI di upload (composer chat AI con paperclip; pannello tutor che mostra allegati di uno studente); integrazione con Anthropic come content blocks `image`/`document` (la prossima sotto-tranche è quella che dà valore reale: lo studente fotografa un esercizio e l'AI lo legge); cleanup deferred dei blob GridFS soft-deleted (oggi restano per sempre — un job batch che cancella `att.deleted_at < now() - 30d` + il blob GridFS corrispondente è 30 righe ma non urgente); rate-limit specifico sul `/uploads` (eredita assente, eventualmente da aggiungere se finisce nel feed pubblico); checksum/dedup (se Luca ricarica lo stesso file, oggi crea due `attachments`, semantica accettabile per il pilota).
  - **Gotcha rilevate**:
    - `@fastify/multipart` 10 con `attachFieldsToBody=false` non garantisce ordine field ↔ file. Convenzione documentata nella rotta: il client deve mettere `student_id` PRIMA del file part nel body multipart, perché iteriamo le parts in ordine d'arrivo. È l'ordine standard di `FormData.append()` nel browser; documentato nel commento.
    - Su Windows + Git Bash + curl, i path `/tmp/...` non vengono risolti automaticamente da curl (è curl mingw32 nativo, non quello di MSYS). Per i test E2E con `-F file=@...` serve usare il path Windows assoluto (es. `C:/Users/LoJag/AppData/Local/Temp/test.png`). Salvato come pattern per i prossimi test multipart da bash su Windows.
    - GridFS `openUploadStream(filename, { metadata, contentType })` ritorna `{id: ObjectId}`; serializzo come stringa via `upload.id.toString()` per metterlo in Postgres come `text`. Il riassemblaggio è `new ObjectId(gridfsId)` al GET.

- [x] **Upload UI — §8.6 sotto-tranche 2** (2026-04-25). Apre il flusso "carica una foto/PDF dal browser" senza più passare da curl. Solo frontend additivo, zero modifiche al backend (il contratto era già pronto da §8.6 st1). L'integrazione con l'AI (image/document content blocks) è la prossima sotto-tranche; in questa il file viene salvato e il suo URL appare come link nel testo del messaggio (workaround pulito che la st3 sostituirà con `attachment_ids` veri).
  - **`api.upload(path, formData)`** in `project/data/api-client.js`: helper multipart che riusa cookie httpOnly via `credentials: 'include'`. Niente `Content-Type` manuale (il browser genera il boundary). Gestisce gli stessi errori del resto del client (`status`, `code`, message). Aggiunto anche `api.attachmentSrc(att)` per costruire l'URL assoluto cross-origin (`API_ORIGIN + att.url`) usato dai tag `<img crossOrigin="use-credentials">` e da `window.open` per il fallback download/preview.
  - **Composer chat AI** (`ChatScreen` in `app/components.jsx` + `pages/AIChat.jsx`):
    - Nuovi prop opzionali su `ChatScreen`: `enableAttach` (default false → non rompe `ChiaraChat` che resta sync senza paperclip), `studentIdForUpload`, `showToast`. Solo `AIChat` li abilita.
    - Bottone 📎 dentro `.composer` con input file nascosto (`accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"`). Click → file picker. Selezione → upload immediato in background. Validation client-side leggera (MIME + size 10 MB) prima di chiamare il backend per evitare round-trip se il file è ovviamente fuori spec.
    - Chip preview sopra l'input mentre c'è un allegato: thumbnail 32×32 (`<img crossOrigin="use-credentials">`) per le immagini, badge "PDF" per i documenti, filename + bottone `rimuovi` (locale, non DELETE — il file resta nel sistema, recuperabile dal pannello tutor).
    - Submit: il messaggio `text` va via SSE come prima; l'allegato viene appeso al testo come `📎 <filename> — <url>` (URL relativo `/api/uploads/:id`). Lo studente lo vede cliccabile nella propria bolla; quando aprirà l'AI in st3 cambierà solo la signature di `onSend(text, attachment)` per passare un `attachment_ids[]` separato. Bottone "invia" si abilita anche con `text` vuoto se c'è un allegato (un'immagine può bastare da sola).
  - **Pannello tutor — sezione Allegati** (`pages/TutorStudent.jsx`): nuovo blocco `AttachmentsBlock` sotto "Già fatto" nel main column. Lazy fetch via `useApi('/uploads?student_id=...')`. Bottone `+ carica file` (input file nascosto) che chiama lo stesso `api.upload` con `student_id` come primo form field (rispetta la convenzione multipart documentata in §10). Lista cronologica con `AttachmentRow`: thumbnail per immagini (`<img crossOrigin="use-credentials">` 72×72), badge "PDF" per documenti, filename + size in KB + data + MIME pill + bottone `cancella` (DELETE soft — il backend autorizza solo l'autore, eventuale 403 sui file altrui viene mostrato come toast). Click su thumbnail/filename apre l'allegato in nuova tab via `window.open` (top-level navigation include il cookie cross-origin senza bisogno di header CORS).
  - **CORS/cookie cross-origin per `<img>`**: `<img crossOrigin="use-credentials">` richiede che il backend risponda con `Access-Control-Allow-Origin: <exact origin>` + `Access-Control-Allow-Credentials: true`. Già garantito dal plugin `@fastify/cors` registrato globalmente (`credentials: true` con allowlist da `CORS_ALLOWED_ORIGINS`). Verificato in browser: PNG 64×64 caricato come Chiara per Luca → renderizzato a video con `naturalWidth=64`.
  - **Verifiche E2E** in browser via preview MCP (server statico locale `:5173` → API Railway):
    - **Tutor**: login Chiara → scheda Luca → sezione Allegati visibile sotto "Già fatto" → caricato PNG 64×64 colorato ("LUCA" stampato) via `api.upload` → comparso in lista con thumbnail, "1 KB", MIME `image/png`, badge "per studente". Caricato anche un PNG 1×1 → l'`<img>` è caricata correttamente (`complete:true`, `naturalW:1`) ma visivamente invisibile come atteso. Cancellati entrambi via DELETE → `{ok:true}`.
    - **Studente**: logout/login Luca → `/chat/ai` → input file nascosto del composer trovato → simulato file picker via `DataTransfer + dispatchEvent('change')` con un PNG `LUCA` colorato → chip preview mostra thumbnail + filename + rimuovi → testo "guarda questa foto del compito, ho un dubbio" + submit → bolla studente contiene `📎 foto-compito.png — /api/uploads/att-xxx`, l'AI risponde consapevole ("non riesco a vedere le immagini, mi dispiace — questa è una mia limitazione tecnica") via streaming SSE. La consapevolezza dell'AI sull'allegato verrà chiusa in §8.6 st3.
    - **Cross-role**: logout Luca → login Chiara → `GET /uploads?student_id=student-luca` → ritorna l'allegato di Luca (`owner_id=student-luca`). Validation: upload `text/plain` come Luca → 400 `MIME_NOT_ALLOWED` (atteso). Reset demo via admin → uploads vuoto sia lato Luca sia lato Chiara (idempotenza wipe da §8.6 st1).
    - **Regressione post-reset**: home Luca 3 upcoming, `/ai/threads/current` 3 messaggi seed, `/tutor/students` 1, `/tutor/students/student-luca/overview` 3 upcoming activities. Tutto verde.
  - **Cosa NON c'è in questa sotto-tranche** (per scope): integrazione AI vera (l'AI non legge ancora la foto — è la st3); UI "i tuoi file" lato studente (decisione UX rimandata: il file è visibile via il link nel messaggio, basta finché non emerge richiesta esplicita); cleanup deferred dei blob soft-deleted; rate-limit specifico su `/uploads`. Il composer di `ChiaraChat` non ha il paperclip — la chat con il tutor umano è testuale per ora; se in futuro Loris vorrà allegare materiale a Chiara basta passare `enableAttach=true`.
  - **Gotcha rilevate**:
    - `<img>` cross-origin con cookie httpOnly NON manda i credentials se `crossOrigin` non è `"use-credentials"`. Senza l'attributo, la GET arriva senza cookie e il backend risponde 401 → l'immagine resta rotta. Salvato come pattern nel componente `AttachmentChipPreview` e in `AttachmentRow`.
    - `serve` (npx serve) NON fa SPA fallback: una full-page navigation a `/tutor/student/...` ritorna 404 statico. La SPA usa hash routing (`#/tutor/...`); per i test E2E browser usare `location.hash = '#/...'` invece di `location.assign('/...')`. Salvato come pattern.
    - `preview_fill` MCP imposta il `value` ma non triggera l'`onChange` di un controlled input React. Per il composer chat (input testo controlled) il workaround è: setta `input.value` + `dispatchEvent(new Event('input', {bubbles:true}))`, oppure usare il pattern `requestSubmit()` su un form pre-compilato lato test. Per il file picker il workaround pulito è `DataTransfer().items.add(file); input.files = dt.files; dispatchEvent('change')`.
    - `<button>` di un input file picker dentro `.composer` eredita lo stile globale `.composer button { width:32px; height:32px; background: var(--ink); border-radius:50% }` — ho dovuto override esplicito (background trasparente, font-size 18px) inline. Inline style ha precedenza, ma width/height fissati dal CSS class restano. Ok per il pilota.

- [x] **Tutor panel UI — sotto-tranche 3a: ripristino activity scartate** (2026-04-25). Backend lo supportava già da §8.3-WRITE st2 (`PATCH /api/tutor/activities/:id` accetta `{dismissed_at: null}` per azzerare la dismissione). Mancava un endpoint per *vedere* gli scartati e l'UI per ripescarli.
  - **Backend** (additivo, una sola rotta in `routes/tutor/students.ts`): `GET /api/tutor/students/:id/dismissed-activities?limit=` ritorna le activity con `dismissedAt IS NOT NULL AND completedAt IS NULL`, ordinate `dismissedAt DESC`, default 20 (max 100). `serializeTutorActivity` espone già `dismissed_at`. Non incluso nel bundle `/overview` perché è una vista "di servizio" — il tutor lo apre solo quando vuole ripescare.
  - **Frontend** (`pages/TutorStudent.jsx`): nuovo blocco `DismissedBlock` sotto "In programma". Parte chiuso (bottone `mostra`/`nascondi`); il fetch parte solo quando aperto via `useApi(..., { enabled: open })`. Riga con titolo barrato + opacity ridotta + bottone `ripristina` che fa `PATCH /tutor/activities/:id` con `{dismissed_at: null}`. Dopo il ripristino refresh-a sia la lista scartati sia l'overview (la activity riappare in "In programma").
  - **Verifiche E2E**: tsc verde. Test browser rimandato — il sandbox blocca curl read verso Railway in questa sessione, ma il path è banale (un endpoint nuovo additivo + una sezione UI lazy).
  - **Cosa NON c'è in questa sotto-tranche** (per scope): notebook curator paginato esteso (mostriamo ancora solo l'ultima nota nella scheda) e UI admin (lo split tra st3a/st3b/... lo faremo se emergono richieste reali). Resta il pattern: UI minima sufficiente al pilota, niente over-engineering.
- [x] **Curator genera proposte a fine sessione (§8.3-AI-PROPOSE sotto-tranche 2)** (2026-04-25, commits `d3064dd` + `7399dd1` + `e5951d1`). Chiude il loop "fine lezione → memoria → proposta → feed" lato backend. Tre commit perché la prima esecuzione E2E ha rivelato due bug latenti, fixati uno alla volta:
  - `d3064dd` — feature di base. `CURATOR_SYSTEM_PROMPT` esteso con un campo `proposals` nel JSON di output (0-3 proposte concrete da 10-30 min, con `rationale` in prima persona indirizzato al tutor; lista vuota se non c'è nulla di sensato). `runCuratorForSession` ora valida con zod ogni proposta (kind ristretto all'enum, subject/title obbligatori, priority/estimated_minutes nei range), scarta silenziosamente quelle malformate (warn log) e inserisce le valide in `activity_proposals` con `status='pending'`, `source_session_id=s.id`, `id` da `genId.proposal()`. Cap a `MAX_PROPOSALS_PER_SESSION=5` contro output patologici. Schema `activity_proposals` invariato (creato in sotto-tranche 1).
  - `7399dd1` — **fix BullMQ jobId**. Il jobId deterministico `curator-${sessionId}` mantenuto in `removeOnComplete.age` (7 giorni) bloccava silenziosamente i re-enqueue dopo `reset-demo`: dopo il reset la sessione tornava `paused`, una nuova chiusura tentava un add con lo stesso jobId, BullMQ scartava → worker non vedeva il job → curator non girava. Cambiato in `curator-${sessionId}-${Date.now()}`. L'idempotency vera è già applicativa (check `curatorNotebook.findOne({session_id})` a inizio `runCuratorForSession`).
  - `e5951d1` — **fix idempotency proposals**. Il check ridondante "skip insert se esistono già proposte con `source_session_id=s.id`" collideva con il seed: `prop-seed-delta-recap` ha già `source_session_id=sess-2026-04-21-math` come dato narrativo demo. Risultato: nota Mongo scritta ma proposte saltate. Rimosso il doppio check; l'idempotency Mongo è sufficiente.
  - Verifiche E2E contro Railway: reset-demo → login luca → answer su `ex-delta-neg-3 c-a` (chiude `sess-2026-04-21-math` perché non c'è esercizio idx=4) → polling fino a 60s → curator scrive nota in ~30s → 3 proposte non-seed inserite con tutti i campi (rationale ricche, kind validi `exercise-set`/`review`, priority 30/50/100, estimated_minutes 10/15/20). Approve sulla prima → activity creata e visibile in `home/upcoming` di Luca (4 invece di 3). Reject con reason → status `rejected` con `rejection_reason` persistito. Regressione: `/students/me/home`, `/tutor/students`, `/tutor/students/:id/overview`, `/tutor/students/:id/notebook` tutti 200.
- [x] **Chat tutor AI in streaming SSE — §8.5** (2026-04-25, commit `6283e0e`). Lo studente vede il messaggio AI crescere token-by-token nel browser invece di apparire tutto in blocco a fine generazione. Endpoint sync esistente lasciato come fallback (la chat ricade su POST normale se lo stream fallisce prima del primo evento). Zero modifiche a schema DB, una sola dipendenza in più richiesta (no — l'SDK Anthropic è già su `0.32.x` con supporto `messages.stream()`).
  - **Backend** (additivo): `services/tutor-agent.ts` splittato in `prepareTutorTurn` (carica history Mongo + persiste subito il messaggio studente con `seq=N+1` + costruisce system prompt + array Anthropic), `finalizeTutorTurn` (persiste l'AI doc finale con tokens_in/out e model), `runTutorTurn` (sync, ora chiama prepare + create + finalize — comportamento identico per il client). Nuova rotta `POST /api/ai/threads/:id/message/stream` in `routes/ai-threads.ts`: stessi guard di auth/ownership/zod del POST sync (errori prima del primo byte ricadono nel `setErrorHandler` globale come 401/403/400/404 JSON), poi emette `text/event-stream` via `reply.send(Readable.from(asyncGenerator))`. Tre eventi:
    - `meta` (subito dopo aver salvato il msg studente) → `{ student: <SerializedMessage>, ai: { id, from, at } }`. Dà al client gli ID definitivi per rimpiazzare l'optimistic e creare il placeholder AI.
    - `delta` (uno per ogni `content_block_delta` con `delta.type === 'text_delta'`) → `{ text: "<chunk>" }`. Il client appende al placeholder AI.
    - `done` (a fine streaming, dopo `stream.finalMessage()` e `finalizeTutorTurn`) → `{ message: <SerializedMessage> }` con id stabile `${threadId}-${seq}` e `at` ufficiale del backend.
    - `error` (catturato dentro l'async generator) → `{ code, message }`. Errori dopo l'apertura non possono cambiare lo status code — vengono notificati come evento.
    Header SSE espliciti (`Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` per i proxy). CORS/cookie restano gestiti dai plugin Fastify upstream perché restituiamo `reply` (no hijack del raw socket).
  - **Frontend** (additivo, due file): `data/api-client.js` espone ora anche `api.stream(path, body, callbacks)`: usa `fetch` con `Accept: text/event-stream` + `credentials: 'include'`, parser SSE inline (split su `\n\n`, prefissi `event:`/`data:`), invoca i callback per nome evento. `pages/AIChat.jsx` ora usa `api.stream` con append incrementale: optimistic user → meta sostituisce con record definitivo + crea placeholder AI vuoto → ogni `delta` accoda chunk al placeholder → `done` finalizza. Fallback automatico al `api.post` esistente se `api.stream` throwa prima del primo callback (es. 5xx pre-stream o rete morta). Toast "errore streaming" se l'errore arriva DOPO l'apertura.
  - **Verifiche E2E** contro Railway:
    - **Backend curl**: SSE happy path (3 eventi `meta` + 6 `delta` + 1 `done` per una risposta di ~280 char in ~3s); lista `GET /ai/threads/current` mostra il messaggio AI persistito con id stabile (`ai-thread-luca-math-5`); fallback POST sync funziona contemporaneamente sullo stesso thread (`-6`/`-7`); guard verificati: senza cookie → 401 `AUTH_REQUIRED`, cookie admin → 403 `FORBIDDEN`, body vuoto → 400 `VALIDATION` con issues zod, thread fantasma → 404 `NOT_FOUND`.
    - **Browser** (preview MCP `:5173` → API Railway): login Luca → `/chat/ai` → submit form composer due volte. Sample del DOM ogni 80ms ha mostrato per la seconda risposta (~475 char) **5 incrementi distinti** dell'ultimo `.msg--them .msg__body` (`0 → 6 → 190 → 389 → 475` char), confermando che il rendering è progressivo, non un salto da vuoto a completo. Console del browser mostra `[api req] POST .../message/stream (stream)` seguito da `[api res] (stream) (closed)` a fine streaming.
    - **Regressioni**: `home_luca`, `tutor_students`, `tutor/students/:id/overview`, `tutor/proposals?status=pending` tutti 200 dopo `reset-demo`; `ai/threads/current` torna a 3 messaggi seed dopo reset (idempotenza wipe verificata).
  - **Cosa NON c'è in questa tranche** (per scope): pulsante "ferma generazione" lato UI (richiede AbortController esposto e `signal` nel fetch — fattibile in <30 righe ma non richiesto); persistenza dell'AI parziale se il browser annulla la fetch a metà (oggi: niente AI doc su Mongo, l'utente può rimandare); rate-limit specifico sul `/message/stream` (eredita assente come la rotta sync); SSE su altre rotte (`POST /sessions/:id/answer` e `POST /threads/:id/messages` restano sync — nessuna richiesta finora).
  - **Gotcha rilevata**: in HTML, un `<button>` senza attributo `type` esplicito è considerato `type="submit"` di default. Selettori automatici come `btns.find(b => b.type === 'submit')` pescano qualunque bottone della topbar prima del button reale del form. Per gli E2E browser sui form, usare il selettore parent (`document.querySelector('.composer').requestSubmit()`) o un selettore CSS più stringente (`form.composer button[type=submit]`). Salvato come pattern.
- [x] **Tutor panel UI — sotto-tranche 2 + §8.4 (scheduling end-to-end)** (2026-04-25, commit `f238ec6`). Chiude il loop "tutor programma un task per X → studente lo vede solo al momento giusto" lato UI. Il backend lo supportava già da §8.3-WRITE st2 (campo `scheduled_for` + filtro `scheduled_for <= now()` su `/students/me/home`); mancava la UI.
  - **Backend** (additivo, una sola modifica in `routes/tutor/students.ts`): l'overview tutor `/api/tutor/students/:id/overview` ora restituisce `upcoming_activities` con `serializeTutorActivity` (campo `scheduled_for` ora esposto, prima null perché `serializeActivity` minimale lo oscurava) e **senza filtro `scheduled_for <= now()`** — il tutor deve vedere anche le activity programmate per il futuro per poterle gestire/modificare/scartare. Lo studente continua a vedere solo le attive ora (filtro `lte` resta in `routes/students.ts`). Limite alzato 10→20 perché il tutor può vedere anche quelle future.
  - **Frontend** (`project/app/pages/TutorStudent.jsx` + `TutorProposals.jsx`): nuovo componente `ActivityForm` riutilizzato in 3 punti — crea, modifica, approva-con-override. Campi: `kind` (select dell'enum), `subject`, `title`, `kicker`, `estimated_minutes`, `priority`, `scheduled_for` (input `datetime-local`). Helpers `isoToLocalInput`/`localInputToIso` per convertire tra ISO 8601 backend e formato `YYYY-MM-DDTHH:mm` del DOM input.
    - **Crea**: `UpcomingBlock` ha un bottone `+ nuovo task` che apre il form vuoto. Submit → `POST /api/tutor/students/:id/activities`.
    - **Modifica**: ogni `UpcomingRow` ha un bottone `modifica` accanto a `scarta` (entrambi colonna verticale a destra). Form pre-compilato dai campi della activity. Submit → `PATCH /api/tutor/activities/:id`. Il dropdown `dismissed_at:null` per ripristinare task scartati c'è nel backend ma non nella UI di questa sotto-tranche (manca un view "scartati" da cui ripristinare).
    - **Approva con modifiche**: `ProposalCard` (in scheda studente) e `GlobalProposalCard` (in coda globale `/tutor/proposals`) hanno un secondo bottone `approva con modifiche…` accanto a `approva → crea task`. Apre il form pre-compilato dai campi della proposta, submit → `POST /api/tutor/proposals/:id/approve` con il body di override. Il backend già accettava tutti questi override (visto in §8.3-AI-PROPOSE st1).
    - **Badge scheduling**: `UpcomingRow` ora mostra un pill `📅 dom 26 apr · 18:00` (color accent-2 muschio) se `scheduled_for > now` — significa "programmata, non ancora visibile allo studente"; `⏱ ven 25 apr · 08:00` (default) se `scheduled_for <= now` — "già nel feed dello studente". Tooltip-friendly via attributo `title`.
    - **API client**: nessuna modifica; `api.patch` era stato aggiunto in §8.3-UI sotto-tranche 1.
    - **Esposizione cross-file**: `ActivityForm` è esportato su `window.ActivityForm` e usato in `TutorProposals.jsx` come `<window.ActivityForm initial={p} ... />` (JSX accetta member access nei tag). Funziona perché `index.html` carica `TutorStudent.jsx` prima di `TutorProposals.jsx`.
  - **Verifiche E2E**: preview MCP locale (`:5173`) contro API Railway. Login Chiara → scheda Luca → `+ nuovo task` apre il form → fill subject="matematica", title="Test scheduling — task futuro", minutes=15, scheduled_for="2026-04-26T18:00" (domani) → click `crea task`. Risultato: row creata in upcoming con pill `📅 dom 26 apr · 18:00`. Login Luca via curl → `/students/me/home`: upcoming count=3 (filtro lte la nasconde). PATCH via curl con `scheduled_for="2026-04-25T06:00:00.000Z"` (passato) → `/students/me/home`: upcoming count=4 (la activity ora visibile a Luca). UI: `approva con modifiche…` su proposta `Cinque domande sugli insiemi` apre il form pre-compilato (kind=quick-test, subject=logica, title corretto, kicker, minutes=10, priority=30) — verifica visiva. Stato demo ripulito con `/admin/reset-demo` dopo i test.
  - **Cosa NON è in questa sotto-tranche** (per scope): UI per ripristinare task scartati (backend supporta `PATCH {dismissed_at:null}` ma manca la lista "scartati"); BullMQ job one-shot su `scheduled_for` per push notification (l'approccio "lazy filter sulla query" è sufficiente per il pilota); notebook curator paginato esteso (rimandato finché non emerge richiesta dall'uso); UI admin (admin entra ma cade sulla home studente — placeholder accettabile, **risolto poi in §8.3-UI st3b parziale del 2026-04-25**).
  - **Gotcha rilevata in test**: `preview_fill` su `<input type="datetime-local">` imposta il DOM ma **non** triggera l'`onChange` di React (controlled component). Per i test E2E delle date dal browser bisogna o (a) usare `_valueTracker` hack, (b) simulare un evento `input` nativo, (c) testare via fetch diretta API. Per questa tranche ho usato (c) per il PATCH di edit; la creazione iniziale ha funzionato col fill perché il form al primo render legge `''` come default.
- [x] **Tutor panel UI — sotto-tranche 1 (§8.3-UI)** (2026-04-25). Prima sezione frontend dedicata al ruolo tutor. Chiara entra dal browser, vede i suoi studenti, apre la scheda di Luca, approva/rifiuta proposte del curator, aggiunge note private. Costruita in `project/` (stesso pattern HTML+React-via-CDN del lato studente, decisione coerente con §8.2 rimandato). Zero modifiche al backend (contratto già completo dalle tranche backend precedenti).
  - **Routing**. `app/main.jsx` introduce role-based routing: dopo login, se `user.role === 'tutor'` → redirect a `/tutor`; tutti i path che non iniziano con `/tutor` vengono incanalati lì. Studente/admin restano sulla home esistente. Aggiunte 3 rotte: `/tutor`, `/tutor/student/:id`, `/tutor/proposals`.
  - **TopBar dedicata**. `TutorTopBar` in `app/components.jsx` con due voci ("I miei studenti" / "Proposte") e datazione "pannello tutor". Riusa avatar/logo/stili esistenti. Lo studente continua a vedere `TopBar` originale (Oggi / Già alle spalle / Cassetta / Chiara) — nessuna regressione lato studente.
  - **3 nuove pagine** in `app/pages/`:
    - `TutorHome.jsx` → lista studenti assegnati con avatar, classe, scuola, hint ultima sessione (subject + status + when), card cliccabile → scheda. In alto a destra: contatore proposte pending → link diretto alla coda. Stato vuoto gestito ("nessuno studente assegnato").
    - `TutorStudent.jsx` → header studente, "ultima nota del curator" con body + signals (topic, confidence%, stumble_points, next_step_hint), "proposte da rivedere" con approve/reject inline (rifiuto opzionalmente con motivo), "in programma" con bottone scarta (DELETE soft), "sessioni recenti", "già fatto", colonna laterale sticky con CRUD note private (form nuova nota + lista con modifica/elimina). Refresh automatico dopo ogni write.
    - `TutorProposals.jsx` → coda globale cross-student con segmented control (pending/approved/rejected), per ogni card: avatar + nome studente cliccabile (→ scheda), kind/subject/minuti, titolo, kicker, rationale del curator in box muschio, azioni approve/reject (per pending), info "decisa il …" (per approved/rejected con motivo se presente).
  - **API client**. `data/api-client.js` ora espone anche `api.patch(...)` (mancava — `PATCH /tutor/notes/:id` lo richiedeva). Una riga aggiunta, zero modifiche al codice esistente.
  - **Verifiche E2E** (browser via preview, server statico locale `:5173` contro API Railway): login Chiara → redirect a `/tutor`; lista studenti mostra Luca con info corrette (Quarta scientifico · Liceo G. Galilei, "matematica · paused", "ultima · 21 apr · 22:14"); contatore proposte pending = 3; click su Luca → scheda con nota curator placeholder, 3 proposte ricche (rationale visibili), 3 upcoming activities; approve "Cinque domande sugli insiemi" → proposta scompare dalla coda pending, attiva refresh overview; navigazione `/tutor/proposals` → tab `approvate` mostra la stessa proposta col badge "approvata"; creazione nota privata "Test E2E UI tutor…" → comparsa immediata nella sidebar; reset-demo da admin per ripulire stato dopo test.
  - **Cosa NON c'è in questa sotto-tranche** (per scope): form di creazione activity manuale (`POST /tutor/students/:id/activities`); modifica fields di una activity (`PATCH /tutor/activities/:id` — il backend lo supporta, lato UI per ora c'è solo "scarta"); override dei campi proposta in fase di approve (l'endpoint accetta body con sovrascritture, qui passiamo body vuoto = usa i campi della proposta tal quali); notebook curator esteso paginato (mostriamo solo l'ultima nota nella scheda); UI admin (admin entra ma cade sulla home studente — **risolto poi in §8.3-UI st3b parziale del 2026-04-25**).
  - **Note di pattern**: il preview MCP gira su porta 5173 (la sola autorizzata da `CORS_ALLOWED_ORIGINS` Railway); aggiunta `.claude/launch.json` minima nel worktree per permettere `preview_start` agli agenti futuri. Per il dev manuale resta valido `npx serve project -l 5173 --no-clipboard` da §11.
- [x] **Pulizia pre-§8.3-UI — 7 micro-fix da audit profondo** (2026-04-25, commit `b04de7a`). Tranche §10.2, additiva, zero feature. Audit profondo del codice prima di aprire la UI tutor: trovati 7 punti che era meglio chiudere ora invece di portarseli dietro.
  - **A1 — codice morto in `services/tutor-agent.ts`**: due `mkId.aiMessage()` generati e gettati con `void`. Rimossi. Aggiunto commento sul perché gli ID restituiti al client usano la chiave deterministica `${threadId}-${seq}` (univoca grazie all'indice Mongo `(thread_id, seq)`).
  - **A2 — accoppiamento bidirezionale tutor → students risolto**: `routes/tutor/students.ts` importava `serializeSession`/`serializeActivity`/`serializeCompletion` da re-export pubblici di `routes/students.ts`. Estratti in nuovo file `routes/serializers.ts` (i serializer comuni alla home studente e all'overview tutor). I serializer "ricchi" specifici del pannello tutor restano in `routes/tutor/serializers.ts`. Aggiornati anche gli importatori in `sessions.ts` e `artifacts.ts`.
  - **A3 — fix N+1 in `GET /tutor/students`**: prima ogni studente assegnato innescava una query separata per "ultima sessione" (`Promise.all` di N query). Sostituito con 1 sola query aggregata (`inArray` su tutti gli studentId, ordinata per `(studentId, lastTouchedAt DESC)`) + map in memoria che tiene il primo per studentId. Sfrutta l'indice esistente `sessions_student_status`. Tipato, drizzle-friendly, deterministico.
  - **A4 — feedback esercizio dal DB invece di hard-coded**: il vecchio `routes/sessions.ts:78` rispondeva `"Esatto. Con a negativo la parabola..."` a OGNI esercizio (anche di italiano o storia). Funzionava per la demo solo perché c'era un solo esercizio. **Nuova migration `0003_wealthy_silverclaw.sql`**: aggiunge le colonne nullable `feedback_correct` e `feedback_wrong` su `exercises`. Seed aggiornato con i due testi sull'esercizio del delta. La rotta legge dai campi del DB, con fallback generici (`"Bene, risposta corretta."` / `"Non ancora. Riprova guardando bene la traccia."`) se i campi sono null.
  - **A5 — validazione zod difensiva sull'output del curator**: prima solo `proposals` era validato. `signals` veniva scritto grezzo su Mongo: se Claude restituiva `confidence: "alta"` o `stumble_points: null`, il tutor avrebbe letto spazzatura nell'overview. Ora `curatorOutputSchema` (zod `.passthrough()`) valida narrative/resume_blurb/outcome/signals/topic_state_suggestion con default sicuri sui campi opzionali. Eventuali campi extra inattesi del modello passano lo stesso senza rompere il parsing.
  - **A6 — `.returning()` invece di insert + select**: pattern sostituito in `routes/threads.ts` (POST messaggio: `at` ora coerente tra response e DB, niente drift di millisecondi) e `routes/admin.ts` (POST/PUT users: una query in meno per chiamata, no più `u!` su select successivo).
  - **A7 — rate-limit su `POST /auth/login`**: aggiunta dipendenza `@fastify/rate-limit` 10.x, registrato con `global:false` in `app.ts`. Solo `/auth/login` lo attiva via `config.rateLimit`: 10 tentativi/IP/minuto. `argon2id.verify` costa ~100ms a chiamata: senza limite una raffica saturava la CPU del container Railway. Store in-memory (single replica). Quando l'API andrà su più repliche, switchare a redis store usando il client esistente.
  - Verifiche E2E contro Railway: `/health` 200; rate-limit verificato (12 login falliti consecutivi → 429 sul 12°); reset-demo + login luca + answer su `ex-delta-neg-3 c-a` → feedback "Esatto. Con a negativo la parabola..." letto **dal DB** (A4 verde); login chiara → `/tutor/students` ritorna `last_session_at/subject/status` corretti dalla nuova query (A3 verde); regressioni `/tutor/students/:id/overview` e `/notebook` 200 (A2 verde); POST messaggio thread → `at` identico tra response e GET successiva (A6 verde); curator chiuso entro 30s con nota Mongo + 3 proposte non-seed (kind validi, rationale ricche, signals con `confidence:0.75`, `stumble_points:[…]`, `next_step_hint`) → A5 verde anche sul path felice. Stato demo ripulito con `/admin/reset-demo` dopo i test.
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
- [ ] Tutor panel WRITE — activities CRUD (fatto), note private (fatto), approve/reject proposte (fatto), curator genera proposte (fatto). Loop "fine lezione → memoria → proposta → feed" chiuso lato backend.
- [x] Tutor panel UI sotto-tranche 1 (home studenti, scheda studente con proposte/note/upcoming, coda proposte cross-student) — fatto. Manca: form create activity manuale, edit activity, override fields in approve, notebook curator paginato esteso, UI admin.
- [ ] Scheduling attività automatiche (BullMQ job one-shot su `scheduled_for`)
- [x] SSE streaming per la chat AI — fatto §8.5 (2026-04-25). Token-by-token nel browser, fallback POST sync, persistenza Mongo identica.
- [x] Upload file backend (PDF, foto compiti, materiali esterni) — fatto §8.6-st1 (2026-04-25). Endpoint POST/GET/DELETE su `/api/uploads` + GridFS storage.
- [x] Upload UI — fatto §8.6-st2 (2026-04-25). Paperclip nel composer chat AI + sezione "Allegati" nel pannello tutor con thumbnail e cancella + pagina `/files` lato studente con voce in topbar. Atterrata in due PR parallele (PR #5 = chat AI + sezione tutor, PR #6 = `/files` + backend fix lista uploads incrociata).
- [x] Integrazione AI allegati — fatto §8.6-st3 (2026-04-25, PR #7). Lo studente allega foto o PDF e Sonnet 4.5 li legge davvero come content block `image`/`document` Anthropic, non più solo l'URL nel testo. `attachment_ids` persistiti su Mongo per la replay history.
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
          │   ├── uploads.ts            ← upload allegati (§8.6-st1, GridFS)
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
0be4bb4 Merge pull request #7 from DocLoJag/claude/infallible-heyrovsky-45f41c
a462b10 feat: integrazione AI allegati — §8.6 sotto-tranche 3
37c7f0c feat: UI upload file — §8.6 sotto-tranche 2a (studente + tutor)
4a49519 feat(backend): upload file — backend §8.6 sotto-tranche 1 (#3)
6283e0e feat: chat tutor AI in streaming SSE — §8.5
f238ec6 feat: §8.3-UI sotto-tranche 2 — scheduling + crea/modifica activity da tutor panel
9ea04cd docs: HANDOFF — tranche §8.3-UI sotto-tranche 1 chiusa (tutor panel UI)
ed7eeb1 feat(frontend): tutor panel UI §8.3-UI sotto-tranche 1
014349f docs: HANDOFF — tranche §10.2 chiusa (audit + 7 micro-fix pre-§8.3-UI)
b04de7a refactor(backend): pulizia pre-§8.3-UI — 7 micro-fix da audit
5c5e4fc docs: HANDOFF — tranche §8.3-AI-PROPOSE sotto-tranche 2 chiusa (curator proposte)
e5951d1 fix(backend): curator — niente skip insert proposte se sourceSessionId esiste
7399dd1 fix(backend): curator jobId con timestamp per consentire re-enqueue post-reset
d3064dd feat(backend): curator genera proposte di task §8.3-AI-PROPOSE sotto-tranche 2
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
- [x] **§8.3-AI-PROPOSE sotto-tranche 2 — curator genera proposte (2026-04-25, commits `d3064dd`+`7399dd1`+`e5951d1`)** — `CURATOR_SYSTEM_PROMPT` esteso con campo `proposals` (0-3, kind ristretto, rationale al tutor); `runCuratorForSession` valida con zod e inserisce in `activity_proposals` (`status=pending`, `source_session_id`). Verificato E2E contro Railway: una sessione chiusa produce 3 proposte ricche, approve crea activity nel feed studente, reject persiste lo status. Dettagli in §2. Zero UI ancora.
- [x] **§8.3-UI sotto-tranche 1 (2026-04-25)** — pagine frontend tutor in `project/` (HTML+React via CDN). Decisione presa: stare nel pattern esistente, niente Next.js per ora (§8.2 resta rimandato). Tre rotte: `/tutor`, `/tutor/student/:id`, `/tutor/proposals`. Role-based redirect post-login. CRUD note private inline, approve/reject proposte da scheda + da coda globale, scarta activity. Verificato E2E in browser. Dettagli sopra in §2.
- [x] **§8.3-UI sotto-tranche 2 + §8.4 scheduling (2026-04-25, commit `f238ec6`)** — form create activity manuale e modifica inline da `UpcomingRow`, override campi in fase di approve proposta (sia da scheda che da coda globale), badge `📅` per activity programmate nel futuro. Backend overview tutor ora espone `scheduled_for` e mostra anche le activity programmate per il futuro (filtro lte tolto). Loop "tutor programma per X → Luca lo vede solo a X" verificato end-to-end. Dettagli in §2.
- [x] **§8.3-UI sotto-tranche 3a — ripristino activity scartate (2026-04-25)** — `GET /api/tutor/students/:id/dismissed-activities` (additivo) + sezione "Scartati" lazy in `TutorStudent.jsx` con bottone `ripristina` che fa `PATCH {dismissed_at: null}` sull'endpoint esistente. Dettagli in §2.
- [x] **§8.3-UI sotto-tranche 3b parziale — UI admin minimale** (2026-04-25). Prima reazione a una richiesta d'uso reale: in dev locale l'admin entrava nella SPA e cadeva sulla home studente, dove l'API rispondeva 403 "endpoint riservato agli studenti". Aggiunto un pannello dedicato.
  - **Routing** (`project/app/main.jsx`): role=admin → redirect a `/admin` post-login e per ogni path non-admin. Role=tutor/student invariati.
  - **Frontend** (additivo): nuova `AdminTopBar` in `components.jsx` (sottotitolo "pannello admin", avatar terra, una sola voce "Utenti"). Nuova pagina `pages/AdminHome.jsx`: saluto + bottone "Reset al seed" (con doppio click di conferma in 4s, distruttivo) + lista utenti raggruppata per ruolo (Studenti/Tutor/Admin) con avatar, full_name, username, classe, scuola, tutor assegnato. Nessun endpoint backend nuovo: usa `GET /admin/users` e `POST /admin/reset-demo` già esistenti.
  - **Verifica**: testato dal browser locale (`:5173` → API Railway). Login `admin/admin2026` → redirect a `/admin` → lista 3 utenti (Luca/Chiara/Admin) corretta → click "reset al seed" mostra "sicuro? clicca ancora" → secondo click → toast "Demo rimessa al seed iniziale".
  - **Cosa resta in §8.3-UI st3b** (per scope minimo): create/edit/delete utenti via UI (oggi via curl), notebook curator paginato esteso (oggi nella scheda tutor mostriamo solo l'ultima nota). Da fare se emerge richiesta.

- [ ] **§8.3-UI sotto-tranche 3b residuo** — notebook curator paginato esteso, CRUD utenti via UI admin. Rimandato fino a richiesta d'uso reale.

### 8.4 Activity scheduling

**Stato:** chiuso end-to-end il 2026-04-25 (commit `f238ec6`, lato UI tutor — backend lo era da §8.3-WRITE st2). Approccio scelto: filtro lazy `scheduled_for <= now()` su `GET /students/me/home`, nessun job BullMQ. Tutor crea/modifica activity con `scheduled_for` futuro dalla UI; lo studente la vede solo dal momento programmato in poi. Dettagli in §2 (sotto-tranche §8.3-UI st2).

Quello che resta fuori scope per il pilota:
- Notifica push PWA quando una activity diventa visibile (richiede service worker e VAPID, fuori dal pattern HTML+React-via-CDN attuale).
- Job BullMQ one-shot al momento `scheduled_for` (utile solo se servisse fare side-effect — invio email/push — oltre al render del feed).

### 8.5 SSE streaming chat AI

**Stato:** chiusa il 2026-04-25 (commit `6283e0e`). Il client ora usa `POST /api/ai/threads/:id/message/stream` per la chat tutor; gli eventi `meta`/`delta`/`done`/`error` arrivano via `text/event-stream` e l'AI cresce token-by-token nel placeholder. Il vecchio `POST /api/ai/threads/:id/message` resta come fallback automatico se lo stream fallisce prima del primo evento. Dettagli completi in §2.

Cosa non è in questa tranche, da valutare se servirà:
- Pulsante "ferma generazione" (richiede AbortController nel fetch e endpoint che chiuda lo stream lato server). 30 righe ma non richiesto dall'uso.
- SSE su altre rotte (`POST /sessions/:id/answer`, `POST /threads/:id/messages`). Restano sync — nessuna esigenza finora.

### 8.6 Upload file (foto compiti, PDF, materiali)

Apre il prossimo gap reale per la lezione: lo studente fotografa un esercizio dal libro / un compito, lo carica e finisce (a) come allegato che il tutor umano può vedere nel pannello, (b) come `image`/`document` content block che la chat AI può leggere. Spezzata in tre sotto-tranche perché è un'aggiunta sostanziale e ogni pezzo è valutabile da solo.

- [x] **§8.6 sotto-tranche 1 — backend storage + endpoint** (2026-04-25, commit `4a49519` su PR #3). Schema `attachments` Postgres + GridFS Mongo (bucket `attachments`) + 5 endpoint sotto `/api/uploads` (POST multipart, GET binario, GET meta, GET lista, DELETE soft). Auth/ownership cross-role + validation MIME/size. Verificato E2E con 20 casi contro Railway. Dettagli in §2.
- [x] **§8.6 sotto-tranche 2 — UI upload** (2026-04-25, atterrata in due PR parallele). Insieme chiudono il gap "il browser sa dove vivono i file":
  - **PR #5 (`3b68e46`)** — paperclip 📎 nel composer chat AI (opt-in via `enableAttach` di `ChatScreen`, abilitato in `AIChat`) con anteprima inline e append `📎 <filename> — <url>` al testo del messaggio (la st3 sostituirà con `attachment_ids` veri come content block Anthropic). `AttachmentsBlock` in `TutorStudent.jsx` con thumbnail per immagini, badge PDF, soft-delete. Helper generico `api.upload(path, formData)`.
  - **Questa PR** — pagina dedicata `/files` lato studente (`pages/Files.jsx`) raggiungibile da nuova voce "I miei file" in topbar; form upload + lista + bottone elimina sui propri file; `<img crossOrigin="use-credentials">` per servire le immagini cross-origin con cookie httpOnly. **Backend fix collaterale**: `GET /api/uploads` lato student ora include anche gli allegati con `studentId = self` (oltre a `ownerId = self`). Coerente con `assertCanAccessAttachment` e con la copy della pagina ("le foto che hai caricato + quelli che ti ha mandato il tutor"). Senza questo fix, lo studente caricava il file dalla chat o lo riceveva dal tutor ma non aveva nessun modo di rivederlo dalla pagina dedicata. Wrapper ergonomico `api.uploadFile(file, {studentId})` che chiama `api.upload`.
  - **Decisione UX presa**: tab `/files` separato dalla cassetta degli attrezzi (`/toolkit`). Distinzione mentale: artifact editoriali del sistema (parabola, mappa, cellula — costruiti dal tutor/AI) vs. file caricati dall'utente (foto compiti, PDF). Si potranno fondere in futuro se l'uso reale lo richiederà.
  - Verifiche E2E in browser via preview MCP: upload da tutor per Luca → comparsa in lista; upload da studente nel composer → chip preview con thumbnail → submit → link in bolla studente; cross-role visibility OK; DELETE soft + reset-demo idempotente; lista lato student include i file caricati dal tutor "per Luca" dopo il fix backend.
- [x] **§8.6 sotto-tranche 3 — integrazione AI** (2026-04-25, PR #7).
  - Body `POST /ai/threads/:id/message{,/stream}` accetta ora `attachment_ids[]` (max 5, almeno text non vuoto o un allegato). Il backend valida ownership con `loadAttachmentsForStudent` (ownerId=self OR studentId=self), scarica i blob da GridFS e crea content block `image` (immagini) o `document` (PDF) per la Messages API. Modello: `claude-sonnet-4-5` (env `ANTHROPIC_MODEL_TUTOR`). Document block accettati a runtime dalla rotta standard, anche se nei tipi SDK 0.32 vivono nel namespace `beta`: cast esplicito al call site.
  - `AiMessageDoc` Mongo persiste `attachment_ids?: string[]`. La replay history nei turni successivi ricarica i blob in batch (cache base64 locale al turno) e ricostruisce gli stessi content block per ogni user message storico, così l'AI mantiene il contesto visivo del thread (vincolato dal cap di 40 messaggi).
  - Frontend `AIChat` ora invia `attachment_ids[]` separato dal testo; `ChatScreen` renderizza `m.attachments` come thumbnail (immagini cliccabili 88×88) o chip PDF nella bolla studente. Verificato E2E end-to-end (sync POST + SSE + replay + cross-ownership 403 + PDF + UI).

Decisioni prese:
- **Storage**: Mongo GridFS (vedi §6.8). Niente S3/R2 per ora — Mongo è già provisioned su Railway, le foto compiti del pilota sono ~1-3 MB, il throughput è basso (un singolo studente). Quando il numero di studenti cresce e il binario diventa significativo, switchare a S3/R2 è additivo (cambiare solo `services/storage.ts`, le rotte non vedono il dettaglio).
- **MIME whitelist**: `image/png|jpeg|webp|gif`, `application/pdf`. Niente HEIC (foto da iPhone) — il browser su iOS converte già a JPEG quando si usa il file picker. Niente Word/PowerPoint/Excel — fuori scope per la lezione.
- **Size cap 10 MB**: sufficiente per una foto buona o un PDF di esercizi. Se un PDF è più grande, va spezzato manualmente.
- **Soft-delete**: cancellare il blob GridFS dietro a un DELETE semantico (hard delete) sembra elegante ma renderebbe l'undelete impossibile e in più potrebbe lasciare riferimenti orfani in messaggi della chat AI già inviati al modello. Soft-delete + cleanup batch deferred è la scelta sicura.

---

## 9. Punti aperti (decisioni da prendere)

1. **Dominio definitivo del frontend pilota**. Opzioni: `pilot.iphigenai.com` / `2.iphigenai.com` / URL Railway auto. Serve per `FRONTEND_ORIGIN`, DNS, cookie domain.
2. ~~**Come applicare migrations**: opzione A, B, o C (job one-shot). Proposto B.~~ **Deciso 2026-04-22**: opzione B via `preDeployCommand: "node dist/db/migrate.js"` in `backend/railway.json`. Idempotente, gira prima del start.
3. **Hosting frontend**: Railway (terzo servizio) o altrove (Vercel, Cloudflare Pages)?
4. **Nome della sezione cassetta** (§6.7 visione): "cassetta degli attrezzi" vs "scaffale" vs "tavolo" vs "appunti". Rimandato.
5. **Nome dell'agente**: generico "il tutor" o nome proprio visibile allo studente?
6. **Modulo consenso parentale aggiornato** (§12 visione) — prima di introdurre studenti reali.
7. **Debiti tecnici rimandati consapevolmente nell'audit del 2026-04-25** (tranche §10.2):
   - **No test suite**. Per il pilota con un singolo studente è accettabile, ma `routes/tutor/guards.ts` (4 funzioni di ownership/auth, critiche di sicurezza) e `services/curator.ts` (parsing JSON LLM, validation proposals) sono i due posti dove un test salverebbe da incidenti silenziosi. Da fare quando il pilota cresce.
   - **ESLint config mancante**. Lo script `npm run lint` esiste ma nessun `.eslintrc*` nel repo: le regole sono i default minimi. Mancano in particolare `no-floating-promises` e `no-misused-promises` che sono utili in un codebase async-heavy.
   - **`req.principal!` ripetuto ovunque** (~40 occorrenze): il decorator è dichiarato `principal: undefined`, post-`requireAuth` è garantito non-undefined ma TypeScript non lo sa. Soluzione cosmetica: ridichiarare il tipo come `principal: AuthPrincipal` con un narrowing globale.
   - **`console.log` sparsi nei servizi runtime** (curator, curator-worker, redis): pino è già setup nel server Fastify ma i moduli "non-route" usano console diretta. Non rompe nulla, va sistemato quando si aggiungerà observability strutturata.
   - **`prepare:false` su postgres-js** (`db/postgres.ts:9`): commento dice "playback-friendly", utile se Railway Postgres avesse pgBouncer in mezzo. Da verificare il setup Railway: se non c'è pgBouncer, `prepare:true` migliorerebbe le performance.
   - **CSRF token**: il cookie `iphigenai_session` ha `SameSite=none` in produzione (cross-origin frontend↔API). Quando frontend e API condivideranno lo stesso root domain (vedi §9.1), si potrà passare a `SameSite=lax/strict` e il rischio CSRF si chiude da solo. Finché restano cross-origin il rischio è basso (il cookie è httpOnly e l'API richiede `Content-Type: application/json` che non è "simple request" CORS).

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
- **BullMQ 5 — jobId trattenuto in `removeOnComplete.age`**: un jobId deterministico (es. `curator-${sessionId}`) viene scartato dal successivo `queue.add()` finché il job precedente è ancora nel set `completed` (di default per `removeOnComplete.age` — qui 7 giorni). Sintomo: `seedDemo` riporta la sessione `paused`, una nuova chiusura accoda nel codice ma BullMQ scarta silenziosamente, il worker non vede il job, il curator non gira. Soluzione applicata: jobId con timestamp (`curator-${sessionId}-${Date.now()}`); l'idempotency è applicativa (check `curatorNotebook.findOne({session_id})` a inizio `runCuratorForSession`). Vale per qualsiasi futura coda con `removeOnComplete.age` > 0 e jobId riusato.
- **Curator — idempotency proposals via Mongo, non via tabella**: per evitare doppio insert in caso di re-run, era tentante aggiungere `WHERE source_session_id = s.id` come guard prima di insertare in `activity_proposals`. Non funziona col seed: `prop-seed-delta-recap` ha già `source_session_id=sess-2026-04-21-math` come dato narrativo, e blocca legittimamente l'insert del curator. La guardia corretta è la nota Mongo (già presente all'inizio di `runCuratorForSession`): se siamo arrivati alle proposals, è la prima esecuzione per quella sessione.
- **~~`err instanceof ZodError` nel setErrorHandler globale non matcha~~** — **RISOLTO il 2026-04-24 (commit `6ddac6b`)**. La causa reale: in Fastify 5 ogni `app.register(plugin)` crea uno scope incapsulato che **fotografa** gli handler del padre al momento del register. Se `setErrorHandler` viene chiamato DOPO il register del plugin che contiene le rotte, lo scope figlio non lo vede e gli errori ricadono sul default di Fastify (che non sa leggere ZodError → 500 col dump degli issues). Fix: spostare `setErrorHandler` (e `setNotFoundHandler`) **prima** di `await app.register(v1routes, { prefix: '/api' })` in `src/app.ts`. Rimosso di conseguenza il workaround `parseBody()` dalle rotte tutor: tutte tornate a `schema.parse()` diretto, come nel resto del codebase. Un body zod invalido su **qualsiasi** rotta (anche admin, students, sessions) ora ritorna 400 `VALIDATION` pulito. Verificato in produzione con `POST /api/admin/users {}`.
- **Chrome incognito blocca i cookie di terze parti di default**: se servi il frontend su `http://localhost:5173` e l'API è su un dominio diverso (Railway), in incognito il cookie di sessione viene scartato e il login sembra "non autorizzato". In modalità normale funziona. Sparirà quando frontend e API condivideranno lo stesso root domain. Non è un bug del backend.
- **Hero null-safe in Home**: `current_session: null` è uno stato legittimo (nessuna sessione attiva). Il componente `Hero` in `project/app/pages/Home.jsx` deve gestirlo — se si aggiungono nuovi componenti che leggono il bundle `/students/me/home`, controllare sempre i campi nullable.
- **CRLF warnings di Git su Windows**: ignorabili.
- **postgres-js è lazy**: non vedi traffico DB finché non parte la prima query.
- **MONGO_URL**: il formato Railway non include il db name in fondo. Il codice fa `client.db(env.MONGO_DB)` separatamente — `MONGO_DB=iphigenai` va settata a parte.
- **CORS con credenziali**: backend deve avere `credentials: true`, frontend deve fare fetch con `credentials: 'include'`, e `FRONTEND_ORIGIN` deve matchare ESATTAMENTE (protocollo + host + porta). No wildcard `*` possibile con credenziali.
- **Windows + bash/sed**: alcune operazioni di file hanno path Windows, usare forward slashes in comandi via Bash tool.
- **curl su bash Windows + UTF-8 multibyte**: passando `-d '{"text":"qualcosa con — em-dash o accenti"}'` da Bash su Windows si può ottenere un 500 con `"Request body size did not match Content-Length"`. È un mismatch tra il calcolo `Content-Length` di curl (su byte) e l'encoding del payload prima del trasporto. Workaround per i test E2E manuali: usare ASCII puro, oppure passare il body via `--data-binary @file.json` con un file UTF-8.
- **`@fastify/rate-limit` con `global:false`**: registrato senza scope globale, va attivato per-rotta con `config.rateLimit`. Se in futuro si vuole un default su tutto il pubblico (es. una soglia anti-abuso generica), togliere `global:false` ma poi fare opt-out esplicito sulle rotte più chiamate (home studente fa polling). Store oggi è in-memory: con più repliche API serve switchare a redis store (riusare il client `redis()` già presente).
- **SSE in Fastify 5 — `reply.send(Readable.from(asyncGenerator))` invece di `reply.hijack()`**: per `text/event-stream` la tentazione è chiamare `reply.hijack()` e scrivere su `reply.raw` direttamente. Funziona ma ti porta a riscrivere a mano `Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials`/`Vary` (i plugin CORS settano gli header sulla `reply` Fastify, non sul raw socket). Più pulito: lasciare che Fastify gestisca gli header (cookie/CORS/keep-alive) e passare uno stream Node.js come body — `reply.send(Readable.from(asyncGenerator()))` fa pipe sul socket con Transfer-Encoding chunked, e ogni `yield` del generator viene inviato subito al client. Nello stesso pattern: `reply.header('Content-Type', 'text/event-stream; charset=utf-8')` + `Cache-Control: no-cache, no-transform` + `X-Accel-Buffering: no` (paranoia anti-proxy). Errori PRIMA del primo `yield` ricadono nel `setErrorHandler` globale (status JSON normale); errori DOPO il primo `yield` non possono cambiare lo status — vanno catchati dentro il generator e notificati come `event: error`.
- **curl mingw32 su Windows + multipart `-F file=@/tmp/...`**: il curl in `Git for Windows` è il binario nativo `mingw32`, non passa per il file-system di MSYS. Quindi `/tmp/test.png` (path stile bash) **non viene risolto** — curl ritorna exit 26 (`Read error`) con HTTP 000. Per i test E2E multipart da bash su Windows servono path Windows assoluti (es. `C:/Users/.../AppData/Local/Temp/test.png`). Per generare il file mantengo bash (`printf '...' > /tmp/x.png`) ma per `curl -F` uso il path Windows. Salvato come pattern.
- **`@anthropic-ai/sdk@0.32` — `document` content block solo nei tipi del namespace `beta`**. La rotta standard `messages.create` accetta a runtime i blocchi `{type:'document', source:{type:'base64', media_type:'application/pdf', data:…}}` su Sonnet 4.5+, ma i tipi TypeScript del `MessageParam` standard non li elencano (li trovi solo in `BetaContentBlockParam` su `resources/beta/messages/messages.d.ts`). Conseguenza: il typecheck rifiuta l'array misto image+document anche se l'API a runtime lo accetta. Fix scelto: cast `as unknown as MessageParam[]` ai due call site (`runTutorTurn` + rotta SSE) con commento esplicativo. Rimedio definitivo è aggiornare l'SDK quando la versione successiva include document block nei tipi standard. Salvato come pattern in `services/tutor-agent.ts` e `routes/ai-threads.ts` (§8.6-st3).
- **HTML `<button>` senza `type` esplicito è `type="submit"` di default**. Selettori automatici lato test (es. preview MCP `eval`) tipo `btns.find(b => b.type === 'submit')` pescano qualunque bottone della topbar prima del button reale del form della chat, e l'effetto collaterale è la navigazione via (`onClick={onBack}`). Per gli E2E browser su un form specifico, sottomettere il form col selettore parent (`document.querySelector('.composer').requestSubmit()`) o restringere il selettore al sottoalbero (`form.composer button[type=submit]`).

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
- **§8.6 sotto-tranche 3 — integrazione AI** (gli allegati immagine/PDF passano come content block ad Anthropic, così la chat AI legge la foto del compito). È la tranche che dà il valore vero: oggi l'AI risponde "non vedo le immagini, mi dispiace" quando lo studente allega una foto. Il backend del messaggio AI deve estendersi per ricevere `attachment_ids` (o continuare a parsare il link `📎 ... — /api/uploads/:id` come fallback retro-compat) e tradurli in content block `image`/`document` base64 per Anthropic. La UI è già pronta (paperclip + chip preview + pagina `/files`).
- **§8.3-UI sotto-tranche 3b** — notebook curator paginato esteso (oggi solo l'ultima nota), CRUD utenti via UI admin. Da fare quando l'uso reale lo richiede. (St3a — ripristino scartati — già fatta; st3b parziale — UI admin minimale — già fatta.)
- **Compliance pre-pilota (§12 visione)** — DPIA, TIA, modulo consenso parentale aggiornato, diritti dell'interessato in UI. Non è una tranche di codice ma è il vero blocker per introdurre studenti reali.
- **§8.2 Porting a Next.js** — infrastrutturale, rimandabile finché il pilota può girare con l'attuale frontend statico.

Non rifare ciò che è già fatto in §2. Non rimettere in discussione le decisioni chiave in §6 senza buon motivo.

Buon lavoro.
