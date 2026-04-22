/* Dettaglio sessione — un esercizio vero */
function SessionPage({ sessionId, user, showToast }) {
  const { data, loading, error } = useApi(`/sessions/${sessionId}`);
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="page"><Skeleton h={300} /></div>;
  if (error) return <div className="page"><div className="card">{error.message}</div></div>;

  const { session, current_exercise: ex } = data;

  const submit = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/sessions/${session.id}/answer`, {
        exercise_id: ex.id,
        choice_id: picked,
      });
      setFeedback(res);
    } catch (e) {
      showToast(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pause = async () => {
    await api.post(`/sessions/${session.id}/pause`);
    showToast('Sessione messa in pausa. Riprenderai da qui.');
    setTimeout(() => navigate('/home'), 800);
  };

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 20 }}>
        <Link to="/home" className="hand small muted">← torna a oggi</Link>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="tag">in sessione · {session.subject}</div>
          <h1 style={{ fontSize: 40, lineHeight: 1.05, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>
            {session.topic}
          </h1>
          <div className="soft" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15 }}>
            {session.focus}
          </div>
        </div>
        <button className="btn btn--ghost" onClick={pause}>metti in pausa</button>
      </div>

      <div className="session">
        <div>
          <div className="exercise">
            <div className="row row--between" style={{ marginBottom: 8 }}>
              <div className="kicker">esercizio {ex.index} di {ex.of}</div>
              <span className="hand small muted">prima prova</span>
            </div>

            <p className="exercise__prompt">{ex.prompt}</p>

            <div className="formula" style={{ textAlign: 'center' }}>{ex.formula}</div>

            <div>
              {ex.choices.map((c) => (
                <div
                  key={c.id}
                  className={`choice ${picked === c.id ? 'on' : ''}`}
                  onClick={() => !feedback && setPicked(c.id)}
                >
                  <span className="choice__letter">{c.letter}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>

            {feedback && (
              <div className="card card--warm" style={{ marginTop: 18 }}>
                <div className="tag" style={{ color: feedback.correct ? 'var(--accent-2)' : 'var(--accent)' }}>
                  {feedback.correct ? 'esatto' : 'non ancora'}
                </div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic', margin: '6px 0 10px', lineHeight: 1.5 }}>
                  {feedback.feedback}
                </p>
                {!feedback.correct && feedback.hint && (
                  <div className="small soft"><strong>suggerimento:</strong> {feedback.hint}</div>
                )}
              </div>
            )}

            <div className="row" style={{ marginTop: 22, justifyContent: 'space-between' }}>
              <button className="btn btn--ghost" onClick={() => setPicked(null)} disabled={!picked || feedback}>
                resetta
              </button>
              {!feedback ? (
                <button className="btn btn--primary" onClick={submit} disabled={!picked || submitting}>
                  {submitting ? 'controllo…' : 'verifica →'}
                </button>
              ) : (
                <button className="btn btn--primary" onClick={() => navigate('/home')}>
                  chiudi sessione →
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="session-aside">
          <div className="card card--cream">
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Dove eravamo rimasti</h3>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              "{session.resume_blurb}"
            </div>
          </div>

          <div className="card">
            <div className="row row--between" style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 16 }}>Progresso</h3>
              <span className="hand small muted">{session.progress.elapsed_minutes}′</span>
            </div>
            <div className="progress-bar" style={{ marginBottom: 6 }}>
              <span style={{ width: ((session.progress.completed + (feedback?.correct ? 1 : 0)) / session.progress.total * 100) + '%' }} />
            </div>
            <div className="small muted">
              {session.progress.completed + (feedback?.correct ? 1 : 0)} di {session.progress.total}
            </div>
          </div>

          <AIBubble />
        </aside>
      </div>
    </div>
  );
}

window.SessionPage = SessionPage;
