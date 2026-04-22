/*
 * Mock API client — simulates a real network layer so the frontend
 * can be built as if the backend already existed.
 *
 * Usage in components:
 *   const { data, error, loading } = useApi('GET /students/me');
 *   await api.post('/sessions/sess-123/answer', { choice_id: 'c-a' });
 *
 * Swap later with a real fetch-based client; routes here match
 * /docs/API.md 1:1.
 *
 * Exposed globally as window.api + window.useApi.
 */
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  const LATENCY_MS_MIN = 180;
  const LATENCY_MS_MAX = 420;
  const STORAGE_KEY = 'iphigenai_session_v1';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randLatency = () =>
    LATENCY_MS_MIN + Math.random() * (LATENCY_MS_MAX - LATENCY_MS_MIN);

  const loadSession = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };
  const saveSession = (s) => {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  };

  let authSession = loadSession();

  const log = (level, ...args) => {
    const style =
      level === 'req' ? 'color:#5a6b3a;font-weight:600'
      : level === 'res' ? 'color:#b54a1f;font-weight:600'
      : 'color:#8b2e1f;font-weight:600';
    console.log(`%c[mock ${level}]`, style, ...args);
  };

  // ─── Route handlers ────────────────────────────────────────────────
  const routes = [];
  const route = (method, pattern, handler) => {
    // pattern like '/sessions/:id/answer' → regex + keys
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) + '$'
    );
    routes.push({ method, re, keys, handler });
  };

  const match = (method, path) => {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = m[i + 1]));
        return { handler: r.handler, params };
      }
    }
    return null;
  };

  const requireAuth = () => {
    if (!authSession) {
      const err = new Error('401 Unauthorized');
      err.status = 401;
      throw err;
    }
    return authSession;
  };

  // ─── POST /auth/login ────────────────────────────────────────────
  route('POST', '/auth/login', (_, body) => {
    const { username, password } = body || {};
    const cred = window.SEED.credentials.find(
      (c) => c.username === username && c.password === password
    );
    if (!cred) {
      const err = new Error('Credenziali non valide');
      err.status = 401;
      throw err;
    }
    const user = window.SEED.users[cred.user_id];
    authSession = {
      token: 'mock-jwt-' + cred.user_id + '-' + Date.now(),
      user,
    };
    saveSession(authSession);
    return { token: authSession.token, user };
  });

  route('POST', '/auth/logout', () => {
    authSession = null;
    saveSession(null);
    return { ok: true };
  });

  route('GET', '/auth/me', () => {
    const s = requireAuth();
    return { user: s.user };
  });

  // ─── Student home bundle ────────────────────────────────────────
  route('GET', '/students/me/home', () => {
    requireAuth();
    return {
      user: window.SEED.users['student-luca'],
      current_session: window.SEED.currentSession,
      upcoming: window.SEED.upcomingActivities,
      toolkit: window.SEED.artifacts,
      completed_recent: window.SEED.completed.slice(0, 3),
      constellation: window.SEED.constellation,
      chiara_thread_preview: {
        id: window.SEED.chiaraThread.id,
        last_message:
          window.SEED.chiaraThread.messages[
            window.SEED.chiaraThread.messages.length - 1
          ],
      },
    };
  });

  // ─── Sessions ───────────────────────────────────────────────────
  route('GET', '/sessions/:id', (params) => {
    requireAuth();
    if (params.id !== window.SEED.currentSession.id) {
      const err = new Error('Sessione non trovata');
      err.status = 404;
      throw err;
    }
    return {
      session: window.SEED.currentSession,
      current_exercise:
        window.SEED.exercises[window.SEED.currentSession.next_exercise_id],
    };
  });

  route('POST', '/sessions/:id/answer', (params, body) => {
    requireAuth();
    const ex = window.SEED.exercises[body.exercise_id];
    if (!ex) {
      const err = new Error('Esercizio non trovato');
      err.status = 404;
      throw err;
    }
    const correct = body.choice_id === ex.correct_choice_id;
    return {
      correct,
      feedback: correct
        ? "Esatto. Con a negativo la parabola è rivolta in basso — partiamo da qui."
        : 'Non ancora. Guarda il segno di a prima di tutto.',
      hint: ex.hint,
      next_exercise_id: null, // ultimo per la demo
    };
  });

  route('POST', '/sessions/:id/pause', () => {
    requireAuth();
    return { ok: true };
  });

  // ─── AI tutor chat ──────────────────────────────────────────────
  route('GET', '/ai/threads/current', () => {
    requireAuth();
    return window.SEED.aiThread;
  });

  route('POST', '/ai/threads/:id/message', (params, body) => {
    requireAuth();
    // Mock reply: fisso ma credibile
    const studentMsg = {
      id: 'ai-' + Date.now(),
      from: 'student',
      at: new Date().toISOString(),
      text: body.text,
    };
    const replies = [
      "Bene. Procediamo passo passo. Hai l'equazione davanti? Qual è il valore di b?",
      "Ottima intuizione. Adesso prova a calcolare b² − 4ac e dimmi cosa viene.",
      "Ti seguo. Prima di andare oltre, ricordiamoci che a è negativo — che segno avrà la parabola?",
      "Ok, allora fermiamoci un attimo. Vuoi che ti faccia un esempio numerico più piccolo?",
    ];
    const reply = {
      id: 'ai-' + (Date.now() + 1),
      from: 'ai',
      at: new Date(Date.now() + 600).toISOString(),
      text: replies[Math.floor(Math.random() * replies.length)],
    };
    return { messages: [studentMsg, reply] };
  });

  // ─── Chiara (human tutor) chat ──────────────────────────────────
  route('GET', '/threads/:id', (params) => {
    requireAuth();
    if (params.id !== window.SEED.chiaraThread.id) {
      const err = new Error('Thread non trovato');
      err.status = 404;
      throw err;
    }
    return window.SEED.chiaraThread;
  });

  route('POST', '/threads/:id/message', (params, body) => {
    requireAuth();
    const msg = {
      id: 'msg-' + Date.now(),
      from: authSession.user.id,
      kind: authSession.user.role === 'tutor' ? 'tutor' : 'student',
      at: new Date().toISOString(),
      text: body.text,
    };
    window.SEED.chiaraThread.messages.push(msg);
    return { message: msg };
  });

  // ─── Artifacts ──────────────────────────────────────────────────
  route('GET', '/artifacts', () => {
    requireAuth();
    return { artifacts: window.SEED.artifacts };
  });

  route('GET', '/artifacts/:id', (params) => {
    requireAuth();
    const a = window.SEED.artifacts.find((x) => x.id === params.id);
    if (!a) {
      const err = new Error('Artifact non trovato');
      err.status = 404;
      throw err;
    }
    return { artifact: a };
  });

  // ─── Archive (già alle spalle) ──────────────────────────────────
  route('GET', '/students/me/completed', (_, __, query) => {
    requireAuth();
    const limit = Number(query?.limit || 50);
    return {
      items: window.SEED.completed.slice(0, limit),
      total: window.SEED.completed.length,
    };
  });

  // ─── Core request dispatcher ────────────────────────────────────
  async function request(method, path, { body, query } = {}) {
    const url = query
      ? path + '?' + new URLSearchParams(query).toString()
      : path;
    log('req', method, url, body || '');
    await sleep(randLatency());

    const m = match(method, path);
    if (!m) {
      const err = new Error(`No mock route for ${method} ${path}`);
      err.status = 404;
      log('err', err.message);
      throw err;
    }
    try {
      const data = await m.handler(m.params, body, query);
      log('res', method, url, data);
      return data;
    } catch (e) {
      log('err', method, url, e.message);
      throw e;
    }
  }

  const api = {
    get:    (p, opts)       => request('GET',    p, opts),
    post:   (p, body, opts) => request('POST',   p, { ...(opts || {}), body }),
    put:    (p, body, opts) => request('PUT',    p, { ...(opts || {}), body }),
    del:    (p, opts)       => request('DELETE', p, opts),
    get session() { return authSession; },
  };

  // ─── React hook: useApi ─────────────────────────────────────────
  function useApi(path, { enabled = true, deps = [] } = {}) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [refreshTick, setRefreshTick] = useState(0);
    const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

    useEffect(() => {
      if (!enabled) { setLoading(false); return; }
      let cancelled = false;
      setLoading(true); setError(null);
      (async () => {
        try {
          const res = await api.get(path);
          if (!cancelled) setData(res);
        } catch (e) {
          if (!cancelled) setError(e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line
    }, [path, enabled, refreshTick, ...deps]);

    return { data, error, loading, refresh };
  }

  window.api = api;
  window.useApi = useApi;
})();
