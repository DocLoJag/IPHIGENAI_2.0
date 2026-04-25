/* Tutor — scheda di un singolo studente */

const ACTIVITY_KINDS = [
  { v: 'review', l: 'review' },
  { v: 'guided-reading', l: 'guided reading' },
  { v: 'quick-test', l: 'quick test' },
  { v: 'analysis', l: 'analysis' },
  { v: 'writing', l: 'writing' },
  { v: 'exercise-set', l: 'exercise set' },
  { v: 'reading', l: 'reading' },
];

// datetime-local <input> usa formato "YYYY-MM-DDTHH:mm" in ora locale.
// Il backend zod usa .datetime({offset:true}) che accetta Z (UTC).
// Conversione bilanciata: per il display si toglie il fuso, per il payload si manda ISO UTC.
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}
function localInputToIso(local) {
  if (!local) return null;
  return new Date(local).toISOString();
}
function formatScheduled(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const future = d.getTime() > now.getTime();
  const day = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return { label: `${day} · ${time}`, future };
}

/* ─── Form attività (riusato per crea / modifica / approve override) ── */
function ActivityForm({ initial, onSubmit, onCancel, submitLabel, busy }) {
  const [kind, setKind] = React.useState(initial?.kind || 'review');
  const [subject, setSubject] = React.useState(initial?.subject || '');
  const [title, setTitle] = React.useState(initial?.title || '');
  const [kicker, setKicker] = React.useState(initial?.kicker || '');
  const [minutes, setMinutes] = React.useState(initial?.estimated_minutes ?? '');
  const [priority, setPriority] = React.useState(initial?.priority ?? 100);
  const [scheduledLocal, setScheduledLocal] = React.useState(
    initial?.scheduled_for ? isoToLocalInput(initial.scheduled_for) : '',
  );

  const submit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim()) return;
    const payload = {
      kind,
      subject: subject.trim(),
      title: title.trim(),
      kicker: kicker.trim() ? kicker.trim() : null,
      estimated_minutes: minutes === '' ? null : Number(minutes),
      priority: Number(priority) || 100,
      scheduled_for: localInputToIso(scheduledLocal),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="card card--soft" style={{ padding: 14, marginBottom: 14 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 140px' }}>
          tipo
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {ACTIVITY_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 140px' }}>
          materia
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="es. matematica" />
        </label>
      </div>
      <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        titolo
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Cinque domande sugli insiemi" />
      </label>
      <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        kicker (descrizione breve)
        <textarea className="input" value={kicker} onChange={(e) => setKicker(e.target.value)} rows={2} style={{ resize: 'vertical', fontFamily: 'var(--serif)' }} />
      </label>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 90px' }}>
          minuti
          <input className="input" type="number" min="0" step="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 90px' }}>
          priorità
          <input className="input" type="number" min="0" step="10" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 200px' }}>
          programmata per (vuoto = subito visibile)
          <input className="input" type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>annulla</button>
        <button type="submit" className="btn btn--primary" disabled={busy || !subject.trim() || !title.trim()}>
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function TutorStudentPage({ studentId, user, showToast }) {
  const { data: overview, loading: lOv, error: eOv, refresh: refreshOverview } =
    useApi(`/tutor/students/${studentId}/overview`);
  const { data: propsData, loading: lProps, refresh: refreshProps } =
    useApi(`/tutor/students/${studentId}/proposals?status=pending`);
  const { data: notesData, loading: lNotes, refresh: refreshNotes } =
    useApi(`/tutor/students/${studentId}/notes`);

  if (lOv) return <div className="page"><Skeleton h={320} /></div>;
  if (eOv) {
    return (
      <div className="page">
        <Link to="/tutor" className="hand small muted" style={{ display: 'inline-block', marginBottom: 12 }}>
          ← torna ai tuoi studenti
        </Link>
        <div className="card">
          {eOv.status === 404 ? 'Studente non trovato.' : `Errore: ${eOv.message}`}
        </div>
      </div>
    );
  }

  const { student, recent_sessions, upcoming_activities, recent_completions, last_curator_note } = overview;
  const proposals = propsData?.items ?? [];
  const notes = notesData?.items ?? [];

  return (
    <div className="page paper-grain">
      <Link to="/tutor" className="hand small muted" style={{ display: 'inline-block', marginBottom: 12 }}>
        ← i tuoi studenti
      </Link>

      <div style={{ marginBottom: 26, display: 'flex', alignItems: 'center', gap: 18 }}>
        <span className="avatar avatar--muschio" style={{ width: 56, height: 56, fontSize: 22 }}>
          {student.avatar_initial}
        </span>
        <div>
          <h1 style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em' }}>{student.full_name || student.name}</h1>
          <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', marginTop: 2 }}>
            {student.grade ?? '—'}{student.school ? ` · ${student.school}` : ''}
          </div>
        </div>
      </div>

      <div className="home-grid" style={{ marginTop: 8 }}>
        <div>
          <CuratorNoteCard note={last_curator_note} />

          <ProposalsBlock
            proposals={proposals}
            loading={lProps}
            onChange={() => { refreshProps(); refreshOverview(); }}
            showToast={showToast}
          />

          <UpcomingBlock
            studentId={studentId}
            items={upcoming_activities}
            onChange={refreshOverview}
            showToast={showToast}
          />

          <DismissedBlock
            studentId={studentId}
            onRestored={refreshOverview}
            showToast={showToast}
          />

          <window.AttachmentsBlock
            studentId={studentId}
            currentUserId={user.id}
            showToast={showToast}
          />

          <SessionsBlock items={recent_sessions} />

          <CompletionsBlock items={recent_completions} />
        </div>

        <aside className="stack" style={{ '--gap': '20px', position: 'sticky', top: 80 }}>
          <NotesBlock
            studentId={studentId}
            notes={notes}
            loading={lNotes}
            onChange={refreshNotes}
            showToast={showToast}
          />
        </aside>
      </div>
    </div>
  );
}

/* ─── Curator note ───────────────────────────────────────── */
function CuratorNoteCard({ note }) {
  if (!note) {
    return (
      <div className="card card--soft" style={{ marginBottom: 28 }}>
        <div className="kicker">ultima nota del curator</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)', marginTop: 6 }}>
          Ancora nessuna nota. Si scrive automaticamente alla chiusura della prima sessione.
        </div>
      </div>
    );
  }
  const sig = note.signals || {};
  const conf = typeof sig.confidence === 'number' ? Math.round(sig.confidence * 100) : null;
  return (
    <div className="card card--cream" style={{ marginBottom: 28 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <div className="kicker">ultima nota del curator</div>
        <span className="hand small muted">{formatWhen(note.written_at)}</span>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
        {note.body}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sig.topic && <span className="pill">topic · {sig.topic}</span>}
        {conf !== null && <span className="pill">confidence · {conf}%</span>}
      </div>
      {Array.isArray(sig.stumble_points) && sig.stumble_points.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-soft)' }}>
          <strong style={{ fontFamily: 'var(--sans)', fontWeight: 600 }}>nodi rimasti:</strong>{' '}
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
            {sig.stumble_points.join(' · ')}
          </span>
        </div>
      )}
      {sig.next_step_hint && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
          <strong style={{ fontFamily: 'var(--sans)', fontWeight: 600 }}>prossimo passo:</strong>{' '}
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{sig.next_step_hint}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Proposals (per studente) ───────────────────────────── */
function ProposalsBlock({ proposals, loading, onChange, showToast }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
        <h2 style={{ fontSize: 22 }}>Proposte da rivedere</h2>
        <span className="hand small muted">dal curator</span>
      </div>
      {loading ? (
        <Skeleton h={120} />
      ) : proposals.length === 0 ? (
        <div className="card card--soft" style={{ padding: 18, fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
          Nessuna proposta in coda. Il curator scriverà nuove proposte alla prossima chiusura sessione.
        </div>
      ) : (
        proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} onChange={onChange} showToast={showToast} />
        ))
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, onChange, showToast }) {
  const [busy, setBusy] = React.useState(null); // 'approve' | 'reject' | null
  const [showReject, setShowReject] = React.useState(false);
  const [showApproveForm, setShowApproveForm] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const doApprove = async (override) => {
    setBusy('approve');
    try {
      await api.post(`/tutor/proposals/${p.id}/approve`, override || {});
      showToast('Proposta approvata — task creato.');
      setShowApproveForm(false);
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      await api.post(`/tutor/proposals/${p.id}/reject`, reason.trim() ? { reason: reason.trim() } : {});
      showToast('Proposta rifiutata.');
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
        <span className="pill">{p.kind.replace('-', ' ')}</span>
        <span className="pill">{p.subject}</span>
        {p.estimated_minutes != null && <span className="pill">{p.estimated_minutes}′</span>}
        <span className="hand small muted" style={{ marginLeft: 'auto' }}>{formatWhen(p.created_at)}</span>
      </div>
      <div style={{ fontFamily: 'var(--title)', fontSize: 19, lineHeight: 1.2, marginBottom: 6 }}>{p.title}</div>
      {p.kicker && (
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: 14, marginBottom: 8 }}>
          {p.kicker}
        </div>
      )}
      {p.rationale && (
        <div style={{
          background: 'var(--paper-warm)',
          padding: '10px 12px',
          borderLeft: '3px solid var(--accent-2)',
          fontSize: 13.5,
          fontFamily: 'var(--serif)',
          color: 'var(--ink-soft)',
          marginBottom: 12,
          whiteSpace: 'pre-wrap',
        }}>
          <span className="hand small muted" style={{ display: 'block', marginBottom: 4 }}>il curator a te</span>
          {p.rationale}
        </div>
      )}
      {showApproveForm ? (
        <ActivityForm
          initial={p}
          onSubmit={doApprove}
          onCancel={() => setShowApproveForm(false)}
          submitLabel="approva con queste modifiche"
          busy={busy === 'approve'}
        />
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn--primary" disabled={busy !== null} onClick={() => doApprove({})}>
            {busy === 'approve' ? 'creo…' : 'approva → crea task'}
          </button>
          <button className="btn" disabled={busy !== null} onClick={() => setShowApproveForm(true)}>
            approva con modifiche…
          </button>
          {showReject ? (
            <>
              <input
                className="input"
                placeholder="perché? (opzionale)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button className="btn" disabled={busy !== null} onClick={reject}>
                {busy === 'reject' ? 'rifiuto…' : 'conferma rifiuto'}
              </button>
              <button className="btn btn--ghost" disabled={busy !== null} onClick={() => { setShowReject(false); setReason(''); }}>
                annulla
              </button>
            </>
          ) : (
            <button className="btn btn--ghost" disabled={busy !== null} onClick={() => setShowReject(true)}>
              rifiuta
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Upcoming activities ───────────────────────────────── */
function UpcomingBlock({ studentId, items, onChange, showToast }) {
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const create = async (payload) => {
    setBusy(true);
    try {
      await api.post(`/tutor/students/${studentId}/activities`, payload);
      showToast('Task creato.');
      setCreating(false);
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 36 }}>
      <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
        <h2 style={{ fontSize: 22 }}>In programma</h2>
        <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
          <span className="hand small muted">{items.length} task attivi</span>
          {!creating && (
            <button className="btn btn--ghost" onClick={() => setCreating(true)} style={{ fontSize: 12, padding: '4px 10px' }}>
              + nuovo task
            </button>
          )}
        </div>
      </div>
      {creating && (
        <ActivityForm
          onSubmit={create}
          onCancel={() => setCreating(false)}
          submitLabel="crea task"
          busy={busy}
        />
      )}
      {items.length === 0 ? (
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', padding: '8px 0' }}>
          Nessun task in coda.
        </div>
      ) : (
        items.map((a) => (
          <UpcomingRow key={a.id} a={a} onChange={onChange} showToast={showToast} />
        ))
      )}
    </div>
  );
}

function UpcomingRow({ a, onChange, showToast }) {
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const dismiss = async () => {
    if (!confirm(`Scartare "${a.title}"?`)) return;
    setBusy(true);
    try {
      await api.del(`/tutor/activities/${a.id}`);
      showToast('Task scartato.');
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (payload) => {
    setBusy(true);
    try {
      await api.patch(`/tutor/activities/${a.id}`, payload);
      showToast('Task aggiornato.');
      setEditing(false);
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <ActivityForm
        initial={a}
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
        submitLabel="salva"
        busy={busy}
      />
    );
  }

  const sched = formatScheduled(a.scheduled_for);

  return (
    <div className="article-row">
      <div className="article-row__thumb placeholder">{a.subject.slice(0, 4)}</div>
      <div className="article-row__body">
        <div className="article-row__kicker">
          {a.kicker || '—'}{a.prepared_by === 'tutor-chiara' ? ' · da te (legacy seed)' : ''}
        </div>
        <div className="article-row__title">{a.title}</div>
        <div className="article-row__meta" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="pill">{a.kind.replace('-', ' ')}{a.estimated_minutes ? ` · ${a.estimated_minutes}′` : ''}</span>
          {sched && (
            <span
              className="pill"
              style={sched.future
                ? { background: 'var(--paper-warm)', borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }
                : undefined}
              title={sched.future ? 'programmata — non ancora visibile allo studente' : 'già visibile allo studente'}
            >
              {sched.future ? '📅 ' : '⏱ '}{sched.label}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignSelf: 'center' }}>
        <button
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => setEditing(true)}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          modifica
        </button>
        <button
          className="btn btn--ghost"
          disabled={busy}
          onClick={dismiss}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          {busy ? '…' : 'scarta'}
        </button>
      </div>
    </div>
  );
}

/* ─── Dismissed activities (lazy) ───────────────────────── */
// Sezione di servizio: il tutor la apre solo quando vuole ripescare un task
// che aveva scartato. Niente fetch automatico — partiamo chiusi.
function DismissedBlock({ studentId, onRestored, showToast }) {
  const [open, setOpen] = React.useState(false);
  const { data, loading, error, refresh } = useApi(
    `/tutor/students/${studentId}/dismissed-activities?limit=20`,
    { enabled: open },
  );

  const items = data?.items ?? [];

  return (
    <div style={{ marginBottom: 36 }}>
      <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
        <h2 style={{ fontSize: 22 }}>Scartati</h2>
        <button
          className="btn btn--ghost"
          onClick={() => setOpen((v) => !v)}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          {open ? 'nascondi' : 'mostra'}
        </button>
      </div>
      {!open ? null : loading ? (
        <Skeleton h={80} />
      ) : error ? (
        <div className="card card--soft" style={{ padding: 14, color: 'var(--danger)' }}>
          Errore nel caricamento scartati: {error.message}
        </div>
      ) : items.length === 0 ? (
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', padding: '8px 0' }}>
          Nessun task scartato.
        </div>
      ) : (
        items.map((a) => (
          <DismissedRow
            key={a.id}
            a={a}
            onRestored={() => { refresh(); onRestored(); }}
            showToast={showToast}
          />
        ))
      )}
    </div>
  );
}

function DismissedRow({ a, onRestored, showToast }) {
  const [busy, setBusy] = React.useState(false);

  const restore = async () => {
    setBusy(true);
    try {
      // backend supporta da §8.3-WRITE st2: PATCH con dismissed_at:null azzera la dismissione.
      await api.patch(`/tutor/activities/${a.id}`, { dismissed_at: null });
      showToast('Task ripristinato.');
      onRestored();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="article-row" style={{ opacity: 0.85 }}>
      <div className="article-row__thumb placeholder" style={{ filter: 'grayscale(40%)' }}>
        {a.subject.slice(0, 4)}
      </div>
      <div className="article-row__body">
        <div className="article-row__kicker">
          scartato {formatWhen(a.dismissed_at)}{a.kicker ? ` · ${a.kicker}` : ''}
        </div>
        <div className="article-row__title" style={{ textDecoration: 'line-through', textDecorationThickness: 1 }}>
          {a.title}
        </div>
        <div className="article-row__meta" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="pill">{a.kind.replace('-', ' ')}{a.estimated_minutes ? ` · ${a.estimated_minutes}′` : ''}</span>
        </div>
      </div>
      <div style={{ alignSelf: 'center' }}>
        <button
          className="btn btn--ghost"
          disabled={busy}
          onClick={restore}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          {busy ? '…' : 'ripristina'}
        </button>
      </div>
    </div>
  );
}

/* ─── Sessions ───────────────────────────────────────────── */
function SessionsBlock({ items }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
        <h2 style={{ fontSize: 22 }}>Sessioni recenti</h2>
        <span className="hand small muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Nessuna sessione ancora.</div>
      ) : (
        items.map((s) => (
          <div key={s.id} className="article-row">
            <div className="article-row__thumb placeholder">{s.subject.slice(0, 4)}</div>
            <div className="article-row__body">
              <div className="article-row__kicker">
                {formatWhen(s.last_touched_at)} · stato {s.status}
              </div>
              <div className="article-row__title">{s.topic}{s.focus ? ` — ${s.focus}` : ''}</div>
              <div className="article-row__meta" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span className="pill">{s.subject}</span>
                {s.progress && (
                  <span className="hand small muted">
                    {s.progress.completed}/{s.progress.total} · {s.progress.elapsed_minutes}′
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Completions ───────────────────────────────────────── */
function CompletionsBlock({ items }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
        <h2 style={{ fontSize: 22 }}>Già fatto</h2>
        <span className="hand small muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Nessun completamento ancora.</div>
      ) : (
        items.map((t) => (
          <div key={t.id} className="archive-row">
            <svg className="archive-row__check" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.5" stroke="var(--accent-2)" strokeWidth="1.2" opacity="0.55" />
              <path d="M6.5 12.5 L10.5 16.5 L17.5 8" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ flex: 1 }}>
              <div className="archive-row__kicker">{formatWhen(t.completed_at)}</div>
              <div className="archive-row__title">{t.title}</div>
              <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                <span className="pill">{t.kind?.replace?.('-', ' ') ?? '—'}{t.duration_minutes ? ` · ${t.duration_minutes}′` : ''}</span>
                {t.outcome && <span className="archive-row__note">— {t.outcome}</span>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Note private del tutor ────────────────────────────── */
function NotesBlock({ studentId, notes, loading, onChange, showToast }) {
  const [draft, setDraft] = React.useState('');
  const [posting, setPosting] = React.useState(false);

  const create = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      await api.post(`/tutor/students/${studentId}/notes`, { body });
      setDraft('');
      showToast('Nota salvata.');
      onChange();
    } catch (err) {
      showToast(`Errore: ${err.message}`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card card--cream">
      <div className="row row--between" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 18 }}>Note private</h3>
        <span className="hand small muted">solo tue</span>
      </div>

      <form onSubmit={create} style={{ marginBottom: 14 }}>
        <textarea
          className="input"
          placeholder="appunti sullo studente — solo per te"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 14 }}
        />
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <button className="btn btn--primary" type="submit" disabled={posting || !draft.trim()}>
            {posting ? 'salvo…' : 'aggiungi'}
          </button>
        </div>
      </form>

      {loading ? (
        <Skeleton h={80} />
      ) : notes.length === 0 ? (
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13 }}>
          Ancora nessuna nota.
        </div>
      ) : (
        notes.map((n) => <NoteRow key={n.id} note={n} onChange={onChange} showToast={showToast} />)
      )}
    </div>
  );
}

function NoteRow({ note, onChange, showToast }) {
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(note.body);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    const next = body.trim();
    if (!next) return;
    setBusy(true);
    try {
      await api.patch(`/tutor/notes/${note.id}`, { body: next });
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Eliminare questa nota?')) return;
    setBusy(true);
    try {
      await api.del(`/tutor/notes/${note.id}`);
      showToast('Nota eliminata.');
      onChange();
    } catch (e) {
      showToast(`Errore: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: '1px dashed var(--ink-faint)', padding: '10px 0' }}>
      <div className="hand small muted" style={{ marginBottom: 4 }}>
        {formatWhen(note.created_at)}{note.updated_at !== note.created_at ? ' · modificata' : ''}
      </div>
      {editing ? (
        <>
          <textarea
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 14 }}
          />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className="btn btn--primary" disabled={busy} onClick={async () => { await save(); setEditing(false); onChange(); }} style={{ fontSize: 12, padding: '4px 10px' }}>
              {busy ? 'salvo…' : 'salva'}
            </button>
            <button className="btn btn--ghost" disabled={busy} onClick={() => { setBody(note.body); setEditing(false); }} style={{ fontSize: 12, padding: '4px 10px' }}>
              annulla
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
            {note.body}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className="btn btn--ghost" disabled={busy} onClick={() => setEditing(true)} style={{ fontSize: 12, padding: '4px 10px' }}>
              modifica
            </button>
            <button className="btn btn--ghost" disabled={busy} onClick={remove} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}>
              elimina
            </button>
          </div>
        </>
      )}
    </div>
  );
}

window.TutorStudentPage = TutorStudentPage;
window.ActivityForm = ActivityForm;
