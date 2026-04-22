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
    del:    (p, opts)       => request('DELETE', p, opts),
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
