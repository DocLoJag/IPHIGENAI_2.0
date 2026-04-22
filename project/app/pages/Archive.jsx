/* Archivio — già alle spalle */
function ArchivePage() {
  const { data, loading } = useApi('/students/me/completed');
  if (loading) return <div className="page"><Skeleton h={300} /></div>;
  const items = data.items;

  const bySubject = items.reduce((acc, t) => {
    (acc[t.subject] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="page page--narrow paper-grain">
      <div style={{ marginBottom: 26 }}>
        <div className="tag">archivio</div>
        <h1 style={{ fontSize: 56, lineHeight: 1.0, letterSpacing: '-0.025em', margin: '6px 0 10px' }}>
          Già alle spalle.
        </h1>
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17, maxWidth: 560 }}>
          Le cose che hai chiuso — non per mostrarle, ma per ricordarti che il ritmo c'è. {items.length} negli ultimi giorni.
        </div>
      </div>

      {Object.entries(bySubject).map(([subj, list]) => (
        <div key={subj} style={{ marginBottom: 32 }}>
          <div className="row row--between" style={{ marginBottom: 8, borderBottom: '1.5px solid var(--ink)', paddingBottom: 6 }}>
            <h2 style={{ fontSize: 22, textTransform: 'capitalize' }}>{subj}</h2>
            <span className="hand small muted">{list.length}</span>
          </div>
          {list.map((t) => (
            <div key={t.id} className="archive-row">
              <svg className="archive-row__check" width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10.5" stroke="var(--accent-2)" strokeWidth="1.2" opacity="0.55" />
                <path d="M6.5 12.5 L10.5 16.5 L17.5 8" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ flex: 1 }}>
                <div className="archive-row__kicker">{formatWhen(t.completed_at)}</div>
                <div className="archive-row__title">{t.title}</div>
                <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                  <span className="pill">{t.kind.replace('-', ' ')} · {t.duration_minutes}′</span>
                  <span className="archive-row__note">— {t.outcome}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="hand" style={{ color: 'var(--accent-2)', textAlign: 'right', fontSize: 15, marginTop: 20 }}>
        tutto quello che resta, resta bene.
      </div>
      <AIBubble />
    </div>
  );
}

window.ArchivePage = ArchivePage;
