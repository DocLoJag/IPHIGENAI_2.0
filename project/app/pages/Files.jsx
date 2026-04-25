/* I miei file — pagina /files lato studente.
 *
 * Backend: /api/uploads (vedi backend/src/routes/uploads.ts).
 * Convenzione cookie: il backend è cross-origin in dev (Railway), quindi
 * gli `<img>` per le anteprime usano `crossOrigin="use-credentials"` per
 * inviare il cookie httpOnly. CORS lato backend è già allowlist+credentials.
 *
 * La sezione "Allegati" lato tutor è invece inline in TutorStudent.jsx
 * (componente `AttachmentsBlock` locale, atterrato in main via PR #5).
 */
function fmtBytes(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

function fileFullUrl(att) {
  // att.url è "/api/uploads/:id" — serve l'origin Railway per cross-origin.
  // window.__API_BASE__ termina in "/api"; rimuoviamolo per non duplicare.
  const base = (window.__API_BASE__ || '').replace(/\/api$/, '');
  return base + att.url;
}

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

/* ─── Form upload (riusato) ──────────────────────────────────── */
function UploadForm({ studentId, onUploaded, showToast, label = 'carica file' }) {
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const inputRef = React.useRef(null);

  // Preview lato client per immagini: blob URL del file selezionato.
  React.useEffect(() => {
    if (!file || !isImageMime(file.type)) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) { setFile(null); return; }
    if (!ALLOWED_MIME.includes(f.type)) {
      showToast(`Tipo non consentito: ${f.type || 'sconosciuto'}.`);
      e.target.value = '';
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      showToast(`File troppo grande (max ${MAX_BYTES / 1024 / 1024} MB).`);
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const opts = studentId ? { studentId } : undefined;
      const att = await api.uploadFile(file, opts);
      showToast('File caricato.');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(att);
    } catch (err) {
      showToast(`Errore: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card--soft" style={{ padding: 14, marginBottom: 18 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME.join(',')}
          onChange={onPick}
          disabled={busy}
          style={{ flex: '1 1 240px', minWidth: 0, fontFamily: 'var(--sans)', fontSize: 13 }}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !file}>
          {busy ? 'carico…' : label}
        </button>
      </div>
      {file && (
        <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'center' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="anteprima" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 4, border: '1px solid var(--ink-faint)' }} />
          ) : (
            <div className="placeholder" style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--hand)', fontSize: 12 }}>
              PDF
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="article-row__title" style={{ fontSize: 14, marginBottom: 2 }}>{file.name}</div>
            <div className="article-row__kicker">{file.type || 'sconosciuto'} · {fmtBytes(file.size)}</div>
          </div>
        </div>
      )}
      <div className="hand small muted" style={{ marginTop: 8 }}>
        formati ammessi: png, jpeg, webp, gif, pdf · max 10 MB
      </div>
    </form>
  );
}

/* ─── Riga lista (riusata) ───────────────────────────────────── */
function AttachmentRow({ att, canDelete, onDeleted, showToast }) {
  const [busy, setBusy] = React.useState(false);
  const fullUrl = fileFullUrl(att);

  const remove = async () => {
    if (!confirm(`Eliminare "${att.filename}"?`)) return;
    setBusy(true);
    try {
      await api.del(`/uploads/${att.id}`);
      showToast('File eliminato.');
      onDeleted();
    } catch (err) {
      showToast(`Errore: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="article-row">
      {isImageMime(att.mime) ? (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="article-row__thumb" style={{ overflow: 'hidden', padding: 0, display: 'block' }}>
          <img
            src={fullUrl}
            crossOrigin="use-credentials"
            alt={att.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </a>
      ) : (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="article-row__thumb placeholder" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--hand)', fontSize: 12 }}>
          PDF
        </a>
      )}
      <div className="article-row__body">
        <div className="article-row__kicker">
          {formatWhen(att.created_at)} · {fmtBytes(att.size_bytes)}
        </div>
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="article-row__title" style={{ color: 'var(--ink)' }}>
          {att.filename}
        </a>
        <div className="article-row__meta" style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="pill">{att.mime}</span>
        </div>
      </div>
      {canDelete && (
        <div style={{ alignSelf: 'center' }}>
          <button className="btn btn--ghost" disabled={busy} onClick={remove} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}>
            {busy ? '…' : 'elimina'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Pagina studente: /files ────────────────────────────────── */
function FilesPage({ user, showToast }) {
  const { data, loading, error, refresh } = useApi('/uploads?limit=50');
  const items = data?.items ?? [];

  return (
    <div className="page page--narrow paper-grain">
      <div style={{ marginBottom: 26 }}>
        <div className="tag">i tuoi file</div>
        <h1 style={{ fontSize: 56, lineHeight: 1.0, letterSpacing: '-0.025em', margin: '6px 0 10px' }}>
          I tuoi file.
        </h1>
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17, maxWidth: 560 }}>
          Le foto dei compiti e i PDF che hai caricato — più quelli che ti ha mandato il tutor. Restano qui, sempre a portata.
        </div>
      </div>

      <UploadForm
        onUploaded={() => refresh()}
        showToast={showToast}
        label="carica"
      />

      {loading ? (
        <Skeleton h={200} />
      ) : error ? (
        <div className="card">{error.message}</div>
      ) : items.length === 0 ? (
        <div className="card card--soft" style={{ padding: 18, fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
          Ancora nessun file. Carica una foto di un esercizio o un PDF per iniziare.
        </div>
      ) : (
        items.map((att) => (
          <AttachmentRow
            key={att.id}
            att={att}
            canDelete={att.owner_id === user.id}
            onDeleted={() => refresh()}
            showToast={showToast}
          />
        ))
      )}

      <AIBubble />
    </div>
  );
}

window.FilesPage = FilesPage;
