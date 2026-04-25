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
    /**
     * Apertura di una connessione SSE su POST. Il server risponde con
     * `text/event-stream` ed emette eventi `event: <name>\ndata: <json>\n\n`.
     * Callbacks ricevono solo l'oggetto `data` deserializzato.
     *
     *   const ctrl = api.stream('/ai/threads/x/stream', { text }, {
     *     onEvent: (name, data) => {...},
     *     onError: (err) => {...},
     *     onClose: () => {...},
     *   });
     *   ctrl.abort(); // per chiudere lato client
     */
    stream: (path, body, { onEvent, onError, onClose, signal } = {}) => {
      const url = API_BASE + path;
      const ac = new AbortController();
      // se il caller passa un AbortSignal esterno lo onoriamo
      if (signal) {
        if (signal.aborted) ac.abort();
        else signal.addEventListener('abort', () => ac.abort(), { once: true });
      }
      log('req', 'POST(stream)', url, body || '');

      (async () => {
        let res;
        try {
          res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify(body ?? {}),
            signal: ac.signal,
          });
        } catch (e) {
          if (ac.signal.aborted) { onClose && onClose(); return; }
          log('err', 'POST(stream)', url, e.message);
          onError && onError(Object.assign(new Error('Errore di rete.'), { status: 0, cause: e }));
          return;
        }

        if (!res.ok) {
          let data = null;
          try { data = await res.json(); } catch {}
          const err = new Error((data && data.message) || `Errore ${res.status}`);
          err.status = res.status;
          if (data && data.code) err.code = data.code;
          log('err', 'POST(stream)', url, err.message);
          onError && onError(err);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';
        let dataLines = [];

        const dispatch = () => {
          if (dataLines.length === 0) {
            currentEvent = 'message';
            return;
          }
          const raw = dataLines.join('\n');
          dataLines = [];
          let payload = null;
          try { payload = JSON.parse(raw); } catch { payload = raw; }
          try { onEvent && onEvent(currentEvent, payload); }
          catch (e) { console.error('[api stream] onEvent threw', e); }
          currentEvent = 'message';
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // SSE record separator: linea vuota.
            let idx;
            while ((idx = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, idx).replace(/\r$/, '');
              buffer = buffer.slice(idx + 1);
              if (line === '') {
                dispatch();
              } else if (line.startsWith(':')) {
                // commento (heartbeat) — ignora
              } else if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).replace(/^ /, ''));
              }
              // altri campi SSE (id:, retry:) ignorati: non li usiamo
            }
          }
          // flush finale se la connessione si chiude senza riga vuota terminale
          dispatch();
        } catch (e) {
          if (ac.signal.aborted) { /* normale */ }
          else {
            log('err', 'POST(stream)', url, e.message);
            onError && onError(Object.assign(new Error('Stream interrotto.'), { status: 0, cause: e }));
          }
        } finally {
          onClose && onClose();
        }
      })();

      return { abort: () => ac.abort() };
    },
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
