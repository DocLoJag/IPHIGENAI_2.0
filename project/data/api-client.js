/*
 * Real API client — parla al backend Fastify via fetch.
 * Mantiene la STESSA superficie di mock-client.js:
 *   window.api.get/post/put/del(path, ...)
 *   window.useApi(path, opts)
 *
 * Differenze rispetto al mock:
 *   - Nessun localStorage: la sessione sta nel cookie httpOnly `iphigenai_session`
 *     emesso dal backend. Il browser lo allega automaticamente se `credentials: 'include'`.
 *   - Path ricevuti senza prefisso (es. '/auth/login'); qui anteponiamo API_BASE.
 *
 * Config:
 *   - window.API_BASE può sovrascrivere la base URL (utile per test locali).
 *   - Default: backend Railway di produzione.
 */
(function () {
  const { useState, useEffect, useCallback } = React;

  const DEFAULT_API_BASE = 'https://api-production-21cc.up.railway.app/api';
  const API_BASE = (window.API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');

  const SENSITIVE_PATHS = ['/auth/login']; // non loggare il body (contiene password)

  const log = (level, method, url, extra) => {
    const style =
      level === 'req' ? 'color:#5a6b3a;font-weight:600'
      : level === 'res' ? 'color:#b54a1f;font-weight:600'
      : 'color:#8b2e1f;font-weight:600';
    console.log(`%c[api ${level}]`, style, method, url, extra ?? '');
  };

  async function request(method, path, { body, query } = {}) {
    const qs = query
      ? '?' + new URLSearchParams(query).toString()
      : '';
    const url = API_BASE + path + qs;
    const isSensitive = SENSITIVE_PATHS.some((p) => path.startsWith(p));
    log('req', method, url, isSensitive ? '[body hidden]' : (body || ''));

    let res;
    try {
      res = await fetch(url, {
        method,
        credentials: 'include', // manda/riceve il cookie httpOnly
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      const err = new Error('Errore di rete. Controlla la connessione.');
      err.status = 0;
      err.cause = netErr;
      log('err', method, url, netErr.message);
      throw err;
    }

    // 204 No Content
    if (res.status === 204) {
      log('res', method, url, '(204)');
      return null;
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      // risposta senza body o non-JSON: tolleriamo
    }

    if (!res.ok) {
      const err = new Error((data && data.message) || `Errore ${res.status}`);
      err.status = res.status;
      if (data && data.code) err.code = data.code;
      log('err', method, url, err.message);
      throw err;
    }

    log('res', method, url, isSensitive ? '[data hidden]' : data);
    return data;
  }

  const api = {
    get:    (p, opts)       => request('GET',    p, opts),
    post:   (p, body, opts) => request('POST',   p, { ...(opts || {}), body }),
    put:    (p, body, opts) => request('PUT',    p, { ...(opts || {}), body }),
    patch:  (p, body, opts) => request('PATCH',  p, { ...(opts || {}), body }),
    del:    (p, opts)       => request('DELETE', p, opts),
  };

  // ─── Upload multipart ──────────────────────────────────────────
  // Caricamento file via FormData. NON settiamo Content-Type a mano:
  // il browser lo deriva (multipart/form-data; boundary=...) automaticamente.
  // CONVENZIONE backend (uploads.ts): `student_id` deve precedere il file
  // nel multipart (ordine FormData rispettato dal browser).
  api.uploadFile = async function uploadFile(file, { studentId } = {}) {
    const url = API_BASE + '/uploads';
    log('req', 'POST', url, { filename: file.name, size: file.size, studentId: studentId || null });

    const fd = new FormData();
    if (studentId) fd.append('student_id', studentId);
    fd.append('file', file, file.name);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
    } catch (netErr) {
      const err = new Error('Errore di rete durante il caricamento.');
      err.status = 0;
      err.cause = netErr;
      log('err', 'POST', url, netErr.message);
      throw err;
    }

    let data = null;
    try { data = await res.json(); } catch { /* no body */ }

    if (!res.ok) {
      const err = new Error((data && data.message) || `Errore ${res.status}`);
      err.status = res.status;
      if (data && data.code) err.code = data.code;
      log('err', 'POST', url, err.message);
      throw err;
    }

    log('res', 'POST', url, data);
    return data;
  };

  // ─── SSE streaming POST ─────────────────────────────
  // Apre una richiesta POST verso un endpoint che risponde con
  // text/event-stream e invoca i callback `on[event](data)` per ogni
  // evento ricevuto. Pattern usato da AIChat per la chat tutor in streaming.
  //
  // Callbacks:
  //   { meta(d), delta(d), done(d), error(d), message({event, data}) }
  // Tutti opzionali. `message` è il fallback per eventi non mappati.
  //
  // Risolve quando lo stream si chiude regolarmente. Throwa se la risposta
  // HTTP iniziale non è 2xx (in quel caso prova a leggere il body JSON
  // dell'errore dal backend, come per le altre chiamate).
  api.stream = async function streamRequest(path, body, callbacks) {
    callbacks = callbacks || {};
    const url = API_BASE + path;
    log('req', 'POST', url + ' (stream)', body || '');

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      const err = new Error('Errore di rete. Controlla la connessione.');
      err.status = 0;
      err.cause = netErr;
      log('err', 'POST', url + ' (stream)', netErr.message);
      throw err;
    }

    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch { /* no body */ }
      const err = new Error((data && data.message) || `Errore ${res.status}`);
      err.status = res.status;
      if (data && data.code) err.code = data.code;
      log('err', 'POST', url + ' (stream)', err.message);
      throw err;
    }

    if (!res.body || !res.body.getReader) {
      const err = new Error('Streaming non supportato dal browser');
      err.status = 0;
      err.code = 'STREAM_UNSUPPORTED';
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const flush = (raw) => {
      // Un blocco SSE: una serie di righe terminate da blank line. Le righe
      // che ci interessano sono `event: <name>` e `data: <payload>`.
      let event = 'message';
      const dataLines = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        // ignora `:` (commenti/heartbeat) e `id:`/`retry:` (non li usiamo)
      }
      if (!dataLines.length) return;
      let data;
      try {
        data = JSON.parse(dataLines.join('\n'));
      } catch (e) {
        log('err', 'POST', url + ' (stream)', 'JSON malformato in evento ' + event);
        return;
      }
      const cb = callbacks[event];
      if (cb) cb(data);
      else if (callbacks.message) callbacks.message({ event, data });
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (raw.trim()) flush(raw);
        }
      }
      // flush eventuale evento residuo se il server non chiude con \n\n
      if (buffer.trim()) flush(buffer);
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }

    log('res', 'POST', url + ' (stream)', '(closed)');
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
  window.__API_BASE__ = API_BASE; // utile per debug da console
})();
