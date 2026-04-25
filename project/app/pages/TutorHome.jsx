/* Tutor home — lista studenti del tutor + contatore proposte pending */
function TutorHomePage({ user, showToast }) {
  const { data: studentsData, loading: lStu, error: eStu } = useApi('/tutor/students');
  const { data: propData, loading: lProp } = useApi('/tutor/proposals?status=pending&limit=100');

  if (lStu) return <TutorHomeSkeleton />;
  if (eStu) {
    return (
      <div className="page">
        <div className="card">Errore: {eStu.message}</div>
      </div>
    );
  }

  const students = studentsData.items;
  const pendingCount = propData?.total ?? 0;

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 26, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <Greeting
          name={user.name}
          sub={`${students.length} studente${students.length === 1 ? '' : 'i'} sotto la tua cura.`}
          size="lg"
        />
        <Link
          to="/tutor/proposals"
          className="card card--cream"
          style={{
            display: 'block',
            minWidth: 240,
            textDecoration: 'none',
            border: pendingCount > 0 ? '1.5px solid var(--accent)' : undefined,
          }}
        >
          <div className="hand small muted" style={{ marginBottom: 4 }}>
            proposte del curator
          </div>
          {lProp ? (
            <div style={{ fontFamily: 'var(--title)', fontSize: 32 }}>…</div>
          ) : (
            <div style={{ fontFamily: 'var(--title)', fontSize: 32, color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-faint)' }}>
              {pendingCount} {pendingCount === 1 ? 'da rivedere' : 'da rivedere'}
            </div>
          )}
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            apri la coda →
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
          <h2 style={{ fontSize: 22 }}>I tuoi studenti</h2>
          <span className="hand small muted">clicca per la scheda</span>
        </div>

        {students.length === 0 ? (
          <div className="card card--soft" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              Nessuno studente assegnato. L'admin deve collegarteli.
            </div>
          </div>
        ) : (
          students.map((s) => (
            <Link
              key={s.id}
              to={`/tutor/student/${s.id}`}
              className="article-row"
              style={{ textDecoration: 'none' }}
            >
              <div className="article-row__thumb" style={{
                background: 'var(--accent-2)',
                color: '#fff',
                fontFamily: 'var(--title)',
                fontSize: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.avatar_initial}
              </div>
              <div className="article-row__body">
                <div className="article-row__kicker">
                  {s.grade ?? '—'}{s.school ? ` · ${s.school}` : ''}
                </div>
                <div className="article-row__title">{s.full_name || s.name}</div>
                <div className="article-row__meta" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  {s.last_session_at ? (
                    <>
                      <span className="pill">
                        {s.last_session_subject ?? 'sessione'} · {s.last_session_status ?? '—'}
                      </span>
                      <span className="hand small muted">
                        ultima · {formatWhen(s.last_session_at)}
                      </span>
                    </>
                  ) : (
                    <span className="hand small muted">nessuna sessione ancora</span>
                  )}
                </div>
              </div>
              <div style={{ alignSelf: 'center', color: 'var(--ink-faint)', fontSize: 22, paddingRight: 8 }}>›</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function TutorHomeSkeleton() {
  return (
    <div className="page">
      <Skeleton w="320px" h={48} />
      <div style={{ marginTop: 32 }}><Skeleton h={28} /></div>
      <div style={{ marginTop: 14 }}><Skeleton h={92} /></div>
      <div style={{ marginTop: 12 }}><Skeleton h={92} /></div>
    </div>
  );
}

window.TutorHomePage = TutorHomePage;
