# IphigenAI — API Contract (v0)

**Autenticazione:** JWT in cookie **httpOnly** (`iphigenai_session`), firmato dal backend e
impostato in risposta a `POST /auth/login`. Il frontend deve fare tutte le chiamate con
`credentials: 'include'` (fetch) o equivalente. Nessun token in `localStorage`, nessun header
`Authorization` lato client.

Tutti gli endpoint richiedono sessione valida tranne `POST /auth/login`.
Base URL: `https://<backend>.up.railway.app/api` (Railway, vedi `backend/README.md`).

Convenzioni:
- Date: ISO-8601 con timezone (`2026-04-21T22:14:00+02:00`).
- Errori: `{ message: string, code?: string }` con status HTTP appropriato.
- Paginazione (quando rilevante): `?limit=N&cursor=...` → risposta `{ items, next_cursor }`.
- CORS: backend accetta solo `FRONTEND_ORIGIN` configurato con `credentials: true`.

---

## Auth

### POST `/auth/login`
Login con username + password. Gli account sono creati a mano dall'admin.

**Body**
```json
{ "username": "luca", "password": "luca2026" }
```
**200** — imposta il cookie `iphigenai_session` (httpOnly, SameSite=Lax in dev / None+Secure in prod).
```json
{
  "user": { "id": "student-luca", "role": "student", "name": "Luca", "avatar_initial": "L", "grade": "Quarta scientifico", "full_name": "Luca Bianchi", "school": "…", "tutor_id": "tutor-chiara" }
}
```
**401** → credenziali invalide.

### POST `/auth/logout`
Invalidate token server-side. Body vuoto. **200** → `{ ok: true }`.

### GET `/auth/me`
Restituisce l'utente del token corrente. **200** → `{ user }`. **401** se token mancante/scaduto.

---

## Studente — home

### GET `/students/me/home`
Bundle unico per dipingere la home studente in una sola chiamata.

**200**
```json
{
  "user": { "id": "student-luca", "name": "Luca", "grade": "Quarta scientifico", "tutor_id": "tutor-chiara", ... },
  "current_session": {
    "id": "sess-…", "subject": "matematica", "topic": "Equazioni di secondo grado",
    "focus": "il momento del delta",
    "started_at": "…", "last_touched_at": "…", "status": "paused",
    "progress": { "completed": 3, "total": 5, "elapsed_minutes": 24 },
    "resume_blurb": "…",
    "next_exercise_id": "ex-…"
  },
  "upcoming": [
    { "id": "act-…", "kind": "review|guided-reading|quick-test|…",
      "subject": "matematica", "title": "…", "kicker": "…",
      "estimated_minutes": 30, "prepared_by": "tutor-chiara|null",
      "priority": 1, "linked_session_id": "sess-…" }
  ],
  "toolkit": [ /* Artifact, vedi sotto */ ],
  "completed_recent": [ /* Completed, vedi sotto */ ],
  "constellation": {
    "updated_at": "…",
    "nodes": [ { "id": "n-…", "label": "Funzioni", "x": 70, "y": 60, "r": 8, "state": "consolidated|working-on|fresh|to-review|behind" } ],
    "edges": [ ["n-a", "n-b"] ],
    "narrative": "testo corto in prima persona dal curatore"
  },
  "chiara_thread_preview": {
    "id": "thread-…",
    "last_message": { "id": "msg-…", "from": "tutor-chiara", "kind": "tutor", "at": "…", "text": "…" }
  }
}
```

### GET `/students/me/completed?limit=50`
Lista compiti già chiusi, più recente prima.

**200**
```json
{
  "items": [
    { "id": "done-…", "title": "…", "kind": "reading|exercise-set|writing|analysis|quick-test",
      "completed_at": "…", "duration_minutes": 22, "outcome": "…", "subject": "italiano" }
  ],
  "total": 5
}
```

---

## Sessioni di studio

### GET `/sessions/:id`
Dettaglio sessione + esercizio corrente.

**200**
```json
{
  "session": { /* come in home */ },
  "current_exercise": {
    "id": "ex-…", "session_id": "sess-…",
    "index": 3, "of": 5,
    "subject": "matematica", "topic": "…",
    "prompt": "testo dell'esercizio",
    "formula": "−2x² + 3x + 1 = 0",
    "choices": [ { "id": "c-a", "letter": "A", "text": "…" } ],
    "hint": "…"
    // "correct_choice_id" NON va restituito al client studente — solo al tutor.
  }
}
```
Nota: `correct_choice_id` è esposto nel mock per semplicità; nel backend vero **non** deve tornare allo studente prima della risposta.

### POST `/sessions/:id/answer`
Invia la risposta dello studente, ricevi feedback + eventualmente esercizio successivo.

**Body** `{ "exercise_id": "ex-…", "choice_id": "c-a" }`
**200**
```json
{
  "correct": true,
  "feedback": "Esatto. Con a negativo la parabola è rivolta in basso…",
  "hint": "…",
  "next_exercise_id": "ex-…|null"
}
```

### POST `/sessions/:id/pause`
Mette la sessione in stato `paused` — verrà riproposta come "dove eri rimasto". **200** → `{ ok: true }`.

---

## Tutor AI (chat)

### GET `/ai/threads/current`
Thread AI attivo per lo studente corrente (uno per volta per ora).

**200**
```json
{
  "id": "ai-thread-…",
  "student_id": "student-luca",
  "subject": "matematica",
  "topic": "Equazioni di secondo grado",
  "opened_at": "…",
  "messages": [
    { "id": "ai-1", "from": "ai|student", "at": "…", "text": "…" }
  ]
}
```

### POST `/ai/threads/:id/message`
Lo studente scrive all'AI. Il backend proxy-a Anthropic e restituisce la coppia studente+risposta.
Per lo streaming, evolverà in SSE (`text/event-stream`) con chunk incrementali.

**Body** `{ "text": "…" }`
**200**
```json
{ "messages": [
  { "id": "student-…", "from": "student", "at": "…", "text": "…" },
  { "id": "ai-…",      "from": "ai",      "at": "…", "text": "…" }
] }
```

---

## Chat con tutor umano (Chiara)

Thread asincrono 1:1 studente ↔ tutor.

### GET `/threads/:id`
**200**
```json
{
  "id": "thread-…",
  "participants": ["student-luca", "tutor-chiara"],
  "messages": [
    { "id": "msg-…", "from": "student-luca|tutor-chiara", "kind": "student|tutor", "at": "…", "text": "…" }
  ]
}
```

### POST `/threads/:id/message`
**Body** `{ "text": "…" }`
**200** `{ "message": { "id": "msg-…", "from": "<current_user_id>", "kind": "tutor|student", "at": "…", "text": "…" } }`

Il `from` è dedotto dal token. Il `kind` è derivato dal ruolo dell'utente.

---

## Cassetta degli attrezzi (artifact)

### GET `/artifacts`
**200** `{ "artifacts": [ Artifact, … ] }`

### GET `/artifacts/:id`
**200** `{ "artifact": Artifact }`

**Artifact**
```json
{
  "id": "art-…", "title": "Parabola viva",
  "kind": "simulation|concept-map|interactive-diagram|…",
  "subject": "matematica",
  "description": "…",
  "created_by": "user-id",
  "created_at": "…",
  "tags": ["equazioni", "delta"],
  "preview": "parabola|map|cell",
  "body": { /* documento libero, schema dipende dal kind */ }
}
```

`body` vive in Mongo (documento libero). Il resto è riga Postgres.

---

## Admin (solo ruolo admin)

### POST `/admin/users`
Crea un account.

**Body**
```json
{
  "role": "student|tutor|admin",
  "username": "luca",
  "password": "luca2026",
  "name": "Luca",
  "full_name": "Luca Bianchi",
  "grade": "Quarta scientifico",
  "tutor_id": "tutor-chiara"
}
```
**201** → `{ user }`.

### GET `/admin/users` → lista utenti paginata.
### PUT `/admin/users/:id` → update.
### DELETE `/admin/users/:id` → disattiva (soft delete).

---

## Error shape
```json
{ "message": "Credenziali non valide", "code": "AUTH_INVALID" }
```
Status code usati: `400` (validation), `401` (auth), `403` (role), `404` (not found), `409` (conflict), `422` (business rule), `500`.
