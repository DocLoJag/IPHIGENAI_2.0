/* Home studente */
function HomePage({ user, showToast }) {
  const { data, loading, error } = useApi('/students/me/home');

  if (loading) return <HomeSkeleton />;
  if (error) return <div className="page"><div className="card">Errore: {error.message}</div></div>;

  const { current_session: s, upcoming, toolkit, completed_recent, constellation, chiara_thread_preview } = data;

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 26, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Greeting
          name={user.name}
          sub={`${user.grade} · mercoledì hai matematica.`}
          size="lg"
        />
        <div style={{ textAlign: 'right', fontFamily: 'var(--hand)', color: 'var(--ink-faint)', fontSize: 14 }}>
          <div style={{ color: 'var(--accent)', fontSize: 16 }}>↓ riprendi subito</div>
          <div>oppure guardati intorno</div>
        </div>
      </div>

      <ChiaraPreview preview={chiara_thread_preview} />

      <div className="home-grid" style={{ marginTop: 28 }}>
        <div>
          <Hero session={s} />

          <div style={{ marginTop: 36 }}>
            <div className="row row--between" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 22 }}>Cosa ti aspetta</h2>
              <span className="hand small muted">preparato da Chiara</span>
            </div>
            {upcoming.map((a) => (
              <div key={a.id} className="article-row" onClick={() => showToast(`"${a.title}" — demo`)}>
                <div className="article-row__thumb placeholder">
                  {a.subject.slice(0, 4)}
                </div>
                <div className="article-row__body">
                  <div className="article-row__kicker">
                    {a.kicker}{a.prepared_by === 'tutor-chiara' ? ' · da Chiara' : ''}
                  </div>
                  <div className="article-row__title">{a.title}</div>
                  <div className="article-row__meta">
                    <span className="pill">{a.kind.replace('-', ' ')} · {a.estimated_minutes}′</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, paddingTop: 22, borderTop: '1.5px solid var(--ink)' }}>
            <div className="row row--between" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22 }}>La tua cassetta degli attrezzi</h2>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  strumenti che hai costruito con Chiara — aprili quando vuoi
                </div>
              </div>
              <Link to="/toolkit" className="hand small muted">vedi tutti →</Link>
            </div>

            <div className="toolkit-grid">
              {toolkit.slice(0, 3).map((a) => (
                <Link key={a.id} to={`/toolkit/${a.id}`} className="toolkit-card">
                  <div className="toolkit-card__thumb"><ArtifactThumb kind={a.preview} /></div>
                  <div className="toolkit-card__body">
                    <div className="toolkit-card__title">{a.title}</div>
                    <div className="toolkit-card__kind">{a.kind} · {a.subject}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 40, paddingTop: 22, borderTop: '1.5px solid var(--ink)' }}>
            <div className="row row--between" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 22 }}>Già alle spalle</h2>
              <Link to="/archive" className="hand small muted">archivio completo →</Link>
            </div>
            {completed_recent.map((t) => (
              <div key={t.id} className="archive-row">
                <svg className="archive-row__check" width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10.5" stroke="var(--accent-2)" strokeWidth="1.2" opacity="0.55" />
                  <path d="M6.5 12.5 L10.5 16.5 L17.5 8" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div className="archive-row__kicker">{formatWhen(t.completed_at)}</div>
                  <div className="archive-row__title">{t.title}</div>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="pill">{t.kind.replace('-', ' ')} · {t.duration_minutes}′</span>
                    <span className="archive-row__note">— {t.outcome}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="stack" style={{ '--gap': '20px', position: 'sticky', top: 80 }}>
          <div className="card card--cream">
            <div className="row row--between" style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 18 }}>Come stai andando</h3>
              <span className="hand small muted">aggiornato ieri</span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
              {constellation.narrative}
            </div>
            <div className="constellation-box">
              <Constellation data={constellation} />
            </div>
          </div>

          <div className="card">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 17 }}>Chiara, il tuo tutor</h3>
              <span className="tag" style={{ fontSize: 12 }}>sempre qui</span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.45, marginBottom: 12 }}>
              "{chiara_thread_preview.last_message.text}"
            </div>
            <Link to="/chiara" className="btn btn--ghost" style={{ display: 'inline-block' }}>scrivi a Chiara →</Link>
          </div>
        </aside>
      </div>

      <AIBubble />
    </div>
  );
}

function Hero({ session }) {
  if (!session) {
    return (
      <div className="hero">
        <div className="hero__head">
          <div className="tag" style={{ marginBottom: 6 }}>nessuna sessione in corso</div>
          <h1 className="hero__title">
            Niente a metà, <em>puoi ripartire quando vuoi.</em>
          </h1>
          <div className="hero__lead">"Scegli una card qui sotto, oppure scrivi all'agente per una conversazione aperta."</div>
        </div>
      </div>
    );
  }
  return (
    <div className="hero">
      <div className="hero__head">
        <div className="tag" style={{ marginBottom: 6 }}>ieri sera, 22:14 — dove eri rimasto</div>
        <h1 className="hero__title">
          {session.topic}, <em>{session.focus}.</em>
        </h1>
        <div className="hero__lead">"{session.resume_blurb}"</div>
      </div>
      <div className="hero__foot">
        <div className="placeholder" style={{ width: 110, height: 72, fontSize: 10 }}>
          foglio di lavoro<br />(snapshot)
        </div>
        <div className="hero__progress">
          <div className="small muted" style={{ marginBottom: 6 }}>
            {session.progress.completed} di {session.progress.total} esercizi · {session.progress.elapsed_minutes} minuti
          </div>
          <div className="progress-bar">
            <span style={{ width: (session.progress.completed / session.progress.total * 100) + '%' }} />
          </div>
        </div>
        <Link to={`/session/${session.id}`} className="btn btn--primary">riprendi →</Link>
      </div>
    </div>
  );
}

function ChiaraPreview({ preview }) {
  const [open, setOpen] = useState(false);
  const { data } = useApi(`/threads/${preview.id}`, { enabled: open });
  return (
    <div className="chiara-thread">
      <button className="chiara-thread__preview" onClick={() => setOpen((o) => !o)}>
        <span className="avatar avatar--muschio" style={{ width: 32, height: 32 }}>C</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hand small muted" style={{ marginBottom: 1 }}>
            Chiara, il tuo tutor · {formatWhen(preview.last_message.at)}
          </div>
          <div style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 13.5, lineHeight: 1.35, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: open ? 'normal' : 'nowrap'
          }}>
            "{preview.last_message.text}"
          </div>
        </div>
        <span className="hand small muted">
          {open ? 'chiudi' : 'cronologia'} <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : '', transition: 'transform .15s' }}>▾</span>
        </span>
      </button>
      {open && (
        <div className="chiara-thread__history">
          {(data?.messages || []).map((m) => {
            const mine = m.kind === 'student';
            return (
              <div key={m.id} className={`msg ${mine ? 'msg--mine' : 'msg--them'}`}>
                <div className="msg__head" style={{ textAlign: mine ? 'right' : 'left' }}>
                  {mine ? 'tu' : 'Chiara'} · {formatWhen(m.at)}
                </div>
                <div className="msg__body">{m.text}</div>
              </div>
            );
          })}
          <Link to="/chiara" className="btn btn--ghost" style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 14px' }}>
            apri conversazione completa →
          </Link>
        </div>
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="page">
      <Skeleton w="260px" h={54} />
      <div style={{ marginTop: 24 }}><Skeleton h={74} /></div>
      <div style={{ marginTop: 24 }}><Skeleton h={240} /></div>
    </div>
  );
}

window.HomePage = HomePage;
