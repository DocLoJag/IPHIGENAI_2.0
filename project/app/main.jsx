/* App shell + routing */
const { useState: useStateA, useEffect: useEffectA } = React;

function App() {
  const route = useRoute();
  const [user, setUser] = useStateA(null);
  const [booting, setBooting] = useStateA(true);
  const [toast, setToast] = useStateA(null);

  const showToast = (m) => setToast(m);

  useEffectA(() => {
    (async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.user);
      } catch (e) {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onLoggedIn = (u) => {
    setUser(u);
    navigate(u.role === 'tutor' ? '/tutor' : '/home');
  };
  const onLogout = async () => {
    await api.post('/auth/logout', {});
    setUser(null);
    showToast('Alla prossima.');
    navigate('/login');
  };

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-cream)' }}>
        <div style={{ fontFamily: 'var(--hand)', color: 'var(--ink-faint)' }}>un attimo…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLoggedIn={onLoggedIn} showToast={showToast} />
        <Toast message={toast} onDone={() => setToast(null)} />
      </>
    );
  }

  // Tutor → pannello dedicato. Tutto ciò che non è /tutor* o /login viene
  // riportato a /tutor (gli studenti hanno la loro home: il tutor non la usa).
  if (user.role === 'tutor') {
    const path = route.path;
    let page;
    let topCurrent = '/tutor';

    if (path === '/' || path === '/home' || path === '/tutor') {
      page = <TutorHomePage user={user} showToast={showToast} />;
      topCurrent = '/tutor';
    } else if (path === '/tutor/proposals') {
      page = <TutorProposalsPage user={user} showToast={showToast} />;
      topCurrent = '/tutor/proposals';
    } else if (path.startsWith('/tutor/student/')) {
      const id = path.replace('/tutor/student/', '');
      page = <TutorStudentPage studentId={id} user={user} showToast={showToast} />;
      topCurrent = '/tutor';
    } else if (path === '/login') {
      navigate('/tutor');
      return null;
    } else {
      page = (
        <div className="page">
          <h1>Pagina non trovata</h1>
          <p className="soft">Il percorso <code>{path}</code> non esiste nel pannello tutor.</p>
          <Link to="/tutor" className="btn btn--ghost">← torna ai tuoi studenti</Link>
        </div>
      );
    }

    return (
      <>
        <TutorTopBar current={topCurrent} user={user} onLogout={onLogout} />
        {page}
        <Toast message={toast} onDone={() => setToast(null)} />
      </>
    );
  }

  // Studente / admin → routing originale
  const path = route.path;
  let page;
  let topCurrent = '/home';

  if (path === '/' || path === '/home') {
    page = <HomePage user={user} showToast={showToast} />;
    topCurrent = '/home';
  } else if (path === '/chat/ai') {
    page = <AIChatPage user={user} showToast={showToast} />;
    return (
      <>
        {page}
        <Toast message={toast} onDone={() => setToast(null)} />
      </>
    );
  } else if (path === '/chiara') {
    page = <ChiaraChatPage user={user} showToast={showToast} />;
    return (
      <>
        {page}
        <Toast message={toast} onDone={() => setToast(null)} />
      </>
    );
  } else if (path.startsWith('/session/')) {
    const id = path.replace('/session/', '');
    page = <SessionPage sessionId={id} user={user} showToast={showToast} />;
  } else if (path === '/toolkit') {
    page = <ToolkitListPage />;
    topCurrent = '/toolkit';
  } else if (path.startsWith('/toolkit/')) {
    const id = path.replace('/toolkit/', '');
    page = <ArtifactDetailPage artifactId={id} />;
    topCurrent = '/toolkit';
  } else if (path === '/archive') {
    page = <ArchivePage />;
    topCurrent = '/archive';
  } else if (path === '/login') {
    navigate('/home');
    return null;
  } else {
    page = (
      <div className="page">
        <h1>Pagina non trovata</h1>
        <p className="soft">Il percorso <code>{path}</code> non esiste ancora.</p>
        <Link to="/home" className="btn btn--ghost">← torna a oggi</Link>
      </div>
    );
  }

  return (
    <>
      <TopBar current={topCurrent} user={user} onLogout={onLogout} />
      {page}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
