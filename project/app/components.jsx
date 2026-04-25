/*
 * Shared UI pieces — Topbar, AIBubble, AIChat, ChiaraThread preview,
 * Constellation SVG, Toolkit thumbs, small helpers.
 *
 * Exposed via window.* so other babel files can consume them.
 */
const { useState, useEffect, useRef } = React;

function TopBar({ current, user, onLogout }) {
  const links = [
    { to: '/home', label: 'Oggi' },
    { to: '/archive', label: 'Già alle spalle' },
    { to: '/toolkit', label: 'Cassetta degli attrezzi' },
    { to: '/chiara', label: 'Chiara' },
  ];
  return (
    <div className="topbar">
      <div className="topbar__left">
        <Link to="/home" className="topbar__logo">
          Iphigen<span className="amp">AI</span>
        </Link>
        <span className="topbar__date">martedì 22 aprile</span>
      </div>
      <nav className="topbar__nav">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={current === l.to ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="topbar__user">
        {user ? (
          <>
            <span className="muted small">{user.name}</span>
            <span className={`avatar ${user.role === 'tutor' ? 'avatar--muschio' : user.role === 'admin' ? 'avatar--terra' : ''}`}>
              {user.avatar_initial}
            </span>
            <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onLogout}>
              esci
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AdminTopBar({ user, onLogout }) {
  return (
    <div className="topbar">
      <div className="topbar__left">
        <Link to="/admin" className="topbar__logo">
          Iphigen<span className="amp">AI</span>
        </Link>
        <span className="topbar__date">pannello admin</span>
      </div>
      <nav className="topbar__nav">
        <Link to="/admin" className="on">Utenti</Link>
      </nav>
      <div className="topbar__user">
        {user ? (
          <>
            <span className="muted small">{user.name}</span>
            <span className="avatar avatar--terra">{user.avatar_initial}</span>
            <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onLogout}>
              esci
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TutorTopBar({ current, user, onLogout }) {
  const links = [
    { to: '/tutor', label: 'I miei studenti' },
    { to: '/tutor/proposals', label: 'Proposte' },
  ];
  return (
    <div className="topbar">
      <div className="topbar__left">
        <Link to="/tutor" className="topbar__logo">
          Iphigen<span className="amp">AI</span>
        </Link>
        <span className="topbar__date">pannello tutor</span>
      </div>
      <nav className="topbar__nav">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={current === l.to ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="topbar__user">
        {user ? (
          <>
            <span className="muted small">{user.name}</span>
            <span className="avatar avatar--muschio">{user.avatar_initial}</span>
            <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onLogout}>
              esci
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Greeting({ name, sub, size = 'lg' }) {
  const sizes = { sm: 28, md: 40, lg: 56 };
  return (
    <div>
      <div style={{ fontFamily: 'var(--title)', fontSize: sizes[size], lineHeight: 1.05, letterSpacing: '-0.015em' }}>
        Buongiorno, {name}.
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: 15, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Constellation({ data }) {
  if (!data) return null;
  const W = 360, H = 260;
  const stateFill = {
    'consolidated': '#1a1816',
    'working-on':   '#b54a1f',
    'fresh':        '#5a6b3a',
    'to-review':    '#bab2a4',
    'behind':       '#d9a441',
  };
  const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {data.edges.map(([a, b], i) => (
        <line key={i}
          x1={byId[a].x} y1={byId[a].y}
          x2={byId[b].x} y2={byId[b].y}
          stroke="#8a837b" strokeWidth="1" strokeDasharray="2 3" />
      ))}
      {data.nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={stateFill[n.state] || '#1a1816'} />
          <text x={n.x + n.r + 4} y={n.y + 3}
            fontSize="9" fontFamily="Kalam, cursive" fill="#3a3632">
            {n.label}
          </text>
        </g>
      ))}
      <g transform="translate(0, 250)">
        <circle cx="6" cy="0" r="4" fill="#b54a1f" />
        <text x="14" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">in lavorazione</text>
        <circle cx="104" cy="0" r="4" fill="#1a1816" />
        <text x="112" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">consolidato</text>
        <circle cx="196" cy="0" r="4" fill="#d9a441" />
        <text x="204" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">indietro</text>
      </g>
    </svg>
  );
}

function ArtifactThumb({ kind }) {
  if (kind === 'parabola') {
    return (
      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
        <line x1="12" y1="78" x2="108" y2="78" stroke="var(--ink)" strokeWidth="1"/>
        <line x1="60" y1="10" x2="60" y2="86" stroke="var(--ink)" strokeWidth="1"/>
        <path d="M18 18 Q 60 100 102 18" fill="none" stroke="var(--accent)" strokeWidth="1.8"/>
        <circle cx="60" cy="72" r="2.6" fill="var(--ink)"/>
      </svg>
    );
  }
  if (kind === 'map') {
    return (
      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
        <circle cx="60" cy="45" r="14" fill="none" stroke="var(--ink)" strokeWidth="1.4"/>
        <text x="60" y="48" textAnchor="middle" style={{ fontFamily: 'var(--title)', fontSize: 9 }} fill="var(--ink)">1492</text>
        <circle cx="20" cy="22" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
        <circle cx="100" cy="22" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
        <circle cx="20" cy="70" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
        <circle cx="100" cy="70" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
        <line x1="48" y1="39" x2="26" y2="26" stroke="var(--ink)" strokeWidth="0.8"/>
        <line x1="72" y1="39" x2="94" y2="26" stroke="var(--ink)" strokeWidth="0.8"/>
        <line x1="48" y1="51" x2="26" y2="66" stroke="var(--ink)" strokeWidth="0.8"/>
        <line x1="72" y1="51" x2="94" y2="66" stroke="var(--ink)" strokeWidth="0.8"/>
      </svg>
    );
  }
  if (kind === 'cell') {
    return (
      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
        <ellipse cx="60" cy="45" rx="44" ry="30" fill="none" stroke="var(--ink)" strokeWidth="1.4"/>
        <ellipse cx="60" cy="45" rx="28" ry="20" fill="none" stroke="var(--ink)" strokeWidth="1"/>
        <circle cx="60" cy="45" r="8" fill="var(--accent-2)" opacity="0.3"/>
        <circle cx="60" cy="45" r="8" fill="none" stroke="var(--ink)" strokeWidth="0.8"/>
        <circle cx="34" cy="38" r="2.5" fill="var(--ink)"/>
        <circle cx="82" cy="54" r="2.5" fill="var(--ink)"/>
      </svg>
    );
  }
  return <div className="placeholder">anteprima</div>;
}

function AIBubble() {
  return (
    <Link to="/chat/ai" className="ai-bubble">
      <div className="ai-bubble__icon">AI</div>
      <div>
        <div className="ai-bubble__title">Parla con il tutor</div>
        <div className="ai-bubble__sub">chiedi qualcosa, o continua da dove eri</div>
      </div>
    </Link>
  );
}

// Tipi MIME accettati dal backend (allineato a backend/routes/uploads.ts).
const CHAT_ATTACH_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const CHAT_ATTACH_ACCEPT = CHAT_ATTACH_MIMES.join(',');
const CHAT_ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function ChatScreen({
  title,
  subtitle,
  avatarInitial,
  avatarClass,
  messages,
  onSend,
  onBack,
  meId,
  enableAttach = false,
  studentIdForUpload = null,
  showToast,
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null); // SerializedAttachment dal backend
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);
  // Auto-scroll: includere la lunghezza dell'ultima risposta come dep, così
  // anche durante lo streaming SSE (messages.length invariato, ma testo che cresce)
  // restiamo incollati al fondo.
  const lastLen = messages.length ? (messages[messages.length - 1].text || '').length : 0;
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages.length, lastLen]);

  const onPickFile = () => {
    if (uploading || attachment) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset del value così se l'utente seleziona lo stesso file dopo aver
    // rimosso il precedente, l'evento change parte comunque.
    e.target.value = '';
    if (!file) return;
    if (!CHAT_ATTACH_MIMES.includes(file.type)) {
      showToast?.(`Tipo file non consentito (${file.type || 'sconosciuto'}).`);
      return;
    }
    if (file.size > CHAT_ATTACH_MAX_BYTES) {
      showToast?.('File troppo grande (max 10 MB).');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      // ORDINE IMPORTANTE: i form fields devono precedere il file part
      // (vedi gotcha multipart in HANDOFF.md §10). FormData del browser
      // preserva l'ordine di append.
      if (studentIdForUpload) fd.append('student_id', studentIdForUpload);
      fd.append('file', file);
      const att = await api.upload('/uploads', fd);
      setAttachment(att);
    } catch (err) {
      showToast?.(`Errore upload: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    // Niente DELETE soft-delete: il file resta nel sistema, lo studente lo
    // recupera comunque dalla lista uploads. Risparmiamo una chiamata.
    setAttachment(null);
  };

  const canSubmit = !uploading && (text.trim() || attachment);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const t = text.trim();
    const att = attachment;
    setText('');
    setAttachment(null);
    await onSend(t, att);
  };

  return (
    <div className="chat paper-grain">
      <div className="chat__head">
        <button className="chat__back" onClick={onBack}>←</button>
        <span className={`avatar ${avatarClass || ''}`} style={{ width: 38, height: 38 }}>{avatarInitial}</span>
        <div style={{ flex: 1 }}>
          <div className="chat__title">{title}</div>
          <div className="chat__subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="chat__body" ref={bodyRef}>
        {messages.map((m) => {
          const mine = m.from === meId || m.from === 'student';
          return (
            <div key={m.id} className={`msg ${mine ? 'msg--mine' : 'msg--them'}`}>
              <div className="msg__head">
                {mine ? 'tu' : (m.from_name || 'il tutor')} · {formatTime(m.at)}
              </div>
              <div className="msg__body">{m.text}</div>
            </div>
          );
        })}
      </div>
      <div className="chat__foot">
        {enableAttach && (attachment || uploading) && (
          <div className="composer-attach" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
            background: 'var(--paper-warm)', borderTop: '1px solid var(--ink-faint)',
            fontFamily: 'var(--sans)', fontSize: 13,
          }}>
            {uploading ? (
              <span className="hand small muted">caricamento allegato…</span>
            ) : (
              <>
                <AttachmentChipPreview att={attachment} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📎 {attachment.filename}
                </span>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="btn btn--ghost"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  aria-label="rimuovi allegato"
                >
                  rimuovi
                </button>
              </>
            )}
          </div>
        )}
        <form className="composer" onSubmit={submit}>
          {enableAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={CHAT_ATTACH_ACCEPT}
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={onPickFile}
                disabled={uploading || !!attachment}
                aria-label="allega un file"
                title={attachment ? 'rimuovi il file corrente per allegarne un altro' : 'allega foto o PDF'}
                style={{
                  background: 'transparent', border: 'none', cursor: uploading || attachment ? 'not-allowed' : 'pointer',
                  padding: '0 8px', fontSize: 18, opacity: uploading || attachment ? 0.4 : 1,
                }}
              >
                📎
              </button>
            </>
          )}
          <input
            placeholder="scrivi…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" aria-label="invia" disabled={!canSubmit}>↑</button>
        </form>
      </div>
    </div>
  );
}

// Chip di anteprima per un allegato nel composer.
// Per immagini: thumbnail 32x32. Per PDF: icona testuale.
function AttachmentChipPreview({ att }) {
  if (!att) return null;
  const isImage = att.mime?.startsWith('image/');
  if (isImage) {
    return (
      <img
        src={api.attachmentSrc(att)}
        alt=""
        crossOrigin="use-credentials"
        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ink-faint)' }}
      />
    );
  }
  return (
    <span style={{
      width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper-cream)', border: '1px solid var(--ink-faint)', borderRadius: 4,
      fontSize: 10, fontFamily: 'var(--sans)', fontWeight: 600,
    }}>PDF</span>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}
function formatWhen(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const t = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (sameDay(d, today)) return 'oggi · ' + t;
    if (sameDay(d, yesterday)) return 'ieri · ' + t;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ' · ' + t;
  } catch (e) { return iso; }
}

function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function Skeleton({ w = '100%', h = 16, style }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

Object.assign(window, {
  TopBar, TutorTopBar, Greeting, Constellation, ArtifactThumb,
  AIBubble, ChatScreen, AttachmentChipPreview,
  formatTime, formatWhen, Toast, Skeleton,
});
