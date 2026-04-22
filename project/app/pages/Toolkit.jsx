/* Cassetta degli attrezzi — lista + dettaglio */
function ToolkitListPage() {
  const { data, loading } = useApi('/artifacts');
  if (loading) return <div className="page"><Skeleton h={300} /></div>;
  const items = data.artifacts;

  const bySubject = items.reduce((acc, a) => {
    (acc[a.subject] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 24 }}>
        <div className="tag">i tuoi strumenti</div>
        <h1 style={{ fontSize: 48, lineHeight: 1.02, margin: '6px 0 8px', letterSpacing: '-0.02em' }}>
          La cassetta degli attrezzi.
        </h1>
        <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, maxWidth: 620 }}>
          Simulazioni, mappe, schemi che hai costruito con Chiara o da solo. Restano qui, sempre a portata — come gli utensili di un laboratorio.
        </div>
      </div>

      {Object.entries(bySubject).map(([subj, list]) => (
        <div key={subj} style={{ marginBottom: 40 }}>
          <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
            <h2 style={{ fontSize: 22, textTransform: 'capitalize' }}>{subj}</h2>
            <span className="hand small muted">{list.length} strument{list.length === 1 ? 'o' : 'i'}</span>
          </div>
          <div className="toolkit-grid">
            {list.map((a) => (
              <Link key={a.id} to={`/toolkit/${a.id}`} className="toolkit-card">
                <div className="toolkit-card__thumb"><ArtifactThumb kind={a.preview} /></div>
                <div className="toolkit-card__body">
                  <div className="toolkit-card__title">{a.title}</div>
                  <div className="toolkit-card__kind">{a.kind} · {formatWhen(a.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <AIBubble />
    </div>
  );
}

function ArtifactDetailPage({ artifactId }) {
  const { data, loading, error } = useApi(`/artifacts/${artifactId}`);
  if (loading) return <div className="page"><Skeleton h={400} /></div>;
  if (error) return <div className="page"><div className="card">{error.message}</div></div>;
  const a = data.artifact;

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 16 }}>
        <Link to="/toolkit" className="hand small muted">← cassetta degli attrezzi</Link>
      </div>

      <div className="artifact-head">
        <div>
          <div className="tag">{a.kind} · {a.subject}</div>
          <h1 style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.02em', margin: '6px 0 10px' }}>
            {a.title}
          </h1>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-soft)', maxWidth: 640, lineHeight: 1.5 }}>
            {a.description}
          </div>
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 6 }}>
            {a.tags.map((t) => <span key={t} className="pill">#{t}</span>)}
          </div>
        </div>
        <div className="hand small muted" style={{ textAlign: 'right' }}>
          creato {formatWhen(a.created_at)}<br />
          {a.created_by === 'tutor-chiara' ? 'da Chiara' : 'da te'}
        </div>
      </div>

      <div className="artifact-canvas">
        <div style={{ width: '60%', height: '80%' }}><ArtifactThumb kind={a.preview} /></div>
      </div>
      <div className="small muted" style={{ marginTop: 10, textAlign: 'center', fontFamily: 'var(--hand)' }}>
        demo — qui vivrà la simulazione interattiva vera e propria
      </div>

      <AIBubble />
    </div>
  );
}

window.ToolkitListPage = ToolkitListPage;
window.ArtifactDetailPage = ArtifactDetailPage;
