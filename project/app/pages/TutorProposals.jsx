/* Tutor — coda globale proposte (cross-student) */
function TutorProposalsPage({ user, showToast }) {
  const [status, setStatus] = React.useState('pending');
  const { data, loading, error, refresh } = useApi(
    `/tutor/proposals?status=${status}&limit=100`,
    { deps: [status] },
  );
  // Per mostrare il nome dello studente in ogni card servirebbe anche la lista
  // studenti — la prendo una volta sola.
  const { data: studentsData } = useApi('/tutor/students');
  const studentMap = React.useMemo(() => {
    const map = {};
    (studentsData?.items || []).forEach((s) => { map[s.id] = s; });
    return map;
  }, [studentsData]);

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 26 }}>
        <div className="tag">proposte del curator</div>
        <h1 style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>
          Coda da rivedere.
        </h1>
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, maxWidth: 600 }}>
          Quello che il curator ti propone a fine sessione. Approva per creare il task,
          rifiuta se non ha senso — la motivazione aiuta a tarare il modello.
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 18, borderBottom: '1.5px solid var(--ink)', paddingBottom: 10 }}>
        {[
          { v: 'pending', l: 'da rivedere' },
          { v: 'approved', l: 'approvate' },
          { v: 'rejected', l: 'rifiutate' },
        ].map((opt) => (
          <button
            key={opt.v}
            className={status === opt.v ? 'btn btn--primary' : 'btn btn--ghost'}
            onClick={() => setStatus(opt.v)}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {opt.l}
          </button>
        ))}
        <span className="hand small muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          {loading ? '…' : `${data?.total ?? 0} totali`}
        </span>
      </div>

      {error && <div className="card">Errore: {error.message}</div>}
      {loading ? (
        <Skeleton h={180} />
      ) : data.items.length === 0 ? (
        <div className="card card--soft" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
            {status === 'pending'
              ? 'Nessuna proposta in attesa. Tutto a posto.'
              : status === 'approved'
                ? 'Ancora nessuna proposta approvata.'
                : 'Ancora nessuna proposta rifiutata.'}
          </div>
        </div>
      ) : (
        data.items.map((p) => (
          <GlobalProposalCard
            key={p.id}
            proposal={p}
            student={studentMap[p.student_id]}
            onChange={refresh}
            showToast={showToast}
          />
        ))
      )}
    </div>
  );
}

function GlobalProposalCard({ proposal: p, student, onChange, showToast }) {
  const [busy, setBusy] = React.useState(null);
  const [showReject, setShowReject] = React.useState(false);
  const [showApproveForm, setShowApproveForm] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const isPending = p.status === 'pending';

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
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
        {student && (
          <Link to={`/tutor/student/${student.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="avatar avatar--muschio" style={{ width: 26, height: 26, fontSize: 12 }}>
              {student.avatar_initial}
            </span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{student.full_name || student.name}</span>
          </Link>
        )}
        <span className="pill">{p.kind.replace('-', ' ')}</span>
        <span className="pill">{p.subject}</span>
        {p.estimated_minutes != null && <span className="pill">{p.estimated_minutes}′</span>}
        {!isPending && (
          <span className={`pill ${p.status === 'approved' ? 'pill--muschio' : 'pill--accent'}`}>
            {p.status === 'approved' ? 'approvata' : 'rifiutata'}
          </span>
        )}
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

      {isPending ? (
        showApproveForm ? (
          <window.ActivityForm
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
        )
      ) : (
        <div className="hand small muted">
          {p.status === 'approved'
            ? `decisa ${formatWhen(p.decided_at)} · task creato`
            : `decisa ${formatWhen(p.decided_at)}${p.rejection_reason ? ` · "${p.rejection_reason}"` : ''}`}
        </div>
      )}
    </div>
  );
}

window.TutorProposalsPage = TutorProposalsPage;
