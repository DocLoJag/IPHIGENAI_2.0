# IphigenAI — Backend Handoff

Pacchetto per chi prende in mano il backend. Tutto quello che qui è mock (latenza simulata, seed JSON) è documentato con il contratto API che il frontend si aspetta, più il modello dati consigliato.

## Stack raccomandato

Scelta in linea con l'infrastruttura già esistente:

- **Runtime:** Node.js ≥ 20, TypeScript.
- **HTTP framework:** **Fastify** (o Express se si vuole massima compatibilità con l'admin panel esistente). Fastify è preferito: schema-first, più veloce, plugin JWT/CORS nativi.
- **Database relazionale:** **PostgreSQL** (≥ 15).
  - Per: profili studenti, tutor, sessioni, attività, messaggi, completamenti.
  - Relazioni chiare → integrità referenziale, query analitiche.
- **Database documentale:** **MongoDB** (riusato dall'admin panel esistente).
  - Per: memoria narrativa del "curatore" (taccuino in prima persona del tutor AI), corpo degli artifact (schemi/simulazioni liberi).
- **Queue:** **BullMQ** su **Redis**.
  - Per: scheduling delle attività ("preparato da Chiara per mercoledì"), esecuzione del curatore a fine sessione (exactly-once), trigger condizionati.
- **LLM:** Anthropic SDK (stesso già in uso), proxied dal backend per non esporre la chiave.
- **Auth:** JWT, **account creati solo dall'admin** (niente registrazione pubblica).
- **Hosting:** da decidere. Possibili: Railway, Fly.io, VPS con Docker Compose (postgres + redis + mongo + api).

## Struttura delle cartelle (frontend)

```
/
├── index.html               ← entry point (app navigabile)
├── app.css                  ← design system "cartaceo"
├── app/
│   ├── router.js            ← hash router minimale
│   ├── components.jsx       ← Topbar, AIBubble, ChatScreen, Constellation…
│   ├── main.jsx             ← App shell, routing
│   └── pages/
│       ├── Login.jsx
│       ├── Home.jsx
│       ├── AIChat.jsx
│       ├── ChiaraChat.jsx
│       ├── Session.jsx
│       ├── Toolkit.jsx
│       └── Archive.jsx
├── data/
│   ├── seed.js              ← dati finti (forma = risposta API reale)
│   └── mock-client.js       ← finto client fetch con latenza
├── docs/
│   ├── API.md               ← contratti REST
│   ├── DATA_MODEL.md        ← schemi Postgres + Mongo
│   └── BACKEND_HANDOFF.md   ← questo file
└── Student Home - Wireframes.html   ← wireframe di riferimento (archivio)
```

## Credenziali mock (solo per la demo frontend)

| username | password      | ruolo    |
|----------|---------------|----------|
| `luca`   | `luca2026`    | studente |
| `chiara` | `chiara2026`  | tutor    |
| `admin`  | `admin2026`   | admin    |

Quando il backend sarà pronto: le credenziali sono create manualmente da admin via endpoint `POST /admin/users`. Nessuna signup pubblica.

## Sostituire il mock con il backend vero

Il frontend usa `window.api.get/post/put/del`. Tutto il mock vive in un solo file (`data/mock-client.js`). Per passare al backend vero basta sostituirlo con questo:

```js
// data/api-client.js (versione reale)
(function () {
  const BASE = window.__API_BASE__ || 'http://localhost:3000/api';
  const getToken = () => localStorage.getItem('iphigenai_token');
  const setToken = (t) => t
    ? localStorage.setItem('iphigenai_token', t)
    : localStorage.removeItem('iphigenai_token');

  async function request(method, path, { body, query } = {}) {
    const url = BASE + path + (query ? '?' + new URLSearchParams(query) : '');
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error((await res.json()).message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  // hook useApi identico a quello del mock
  // ...
  window.api = {
    get: (p, o) => request('GET', p, o),
    post: (p, b, o) => request('POST', p, { ...o, body: b }),
    // ...
  };
})();
```

Le route in `API.md` sono definite **esattamente** come il mock le espone — `GET /students/me/home`, `POST /sessions/:id/answer`, etc.

## Decisioni ancora aperte

- **Realtime chat (AI + Chiara):** polling vs SSE vs WebSocket. Al momento il frontend fa POST sincrono. Per lo streaming LLM serve SSE (o fetch-stream).
- **File upload:** non previsto in questa tranche. Quando arriverà (foto di compiti, PDF), serve S3-compatible (R2/MinIO).
- **i18n:** solo italiano per ora, ma i testi sono nei componenti — se servirà tradurli servirà estrarli in un JSON.
- **Hosting/deploy:** da decidere.

## Cosa testare subito

1. Aprire `index.html` in un browser.
2. Login come `luca / luca2026` → home studente.
3. Click "cronologia" sulla striscia Chiara → conversazione espansa.
4. Click "riprendi" → pagina sessione con esercizio vero (risposta corretta: A).
5. Click bolla "Parla con il tutor" in basso a destra → chat AI.
6. Top-nav → "Chiara", "Cassetta degli attrezzi", "Già alle spalle".
7. Logout → rientra come `chiara` per vedere la stessa thread dal lato tutor.

## Dev console

Il mock client logga ogni richiesta/risposta in console:
- `[mock req] GET /students/me/home`
- `[mock res] GET /students/me/home {...}`

Utile per verificare che il frontend chiami esattamente gli endpoint giusti.
