/* Login page */
const { useState: useStateL } = React;

function LoginPage({ onLoggedIn, showToast }) {
  const [username, setUsername] = useStateL('luca');
  const [password, setPassword] = useStateL('luca2026');
  const [role, setRole] = useStateL('student');
  const [loading, setLoading] = useStateL(false);
  const [error, setError] = useStateL(null);

  const quickFill = (r) => {
    setRole(r);
    if (r === 'student')   { setUsername('luca');   setPassword('luca2026'); }
    if (r === 'tutor')     { setUsername('chiara'); setPassword('chiara2026'); }
    if (r === 'admin')     { setUsername('admin');  setPassword('admin2026'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/login', { username, password });
      showToast(`Benvenuto, ${res.user.name}.`);
      onLoggedIn(res.user);
    } catch (err) {
      setError(err.message || 'Errore di accesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-shell__art paper-grain">
        <div className="topbar__logo" style={{ color: 'var(--paper-cream)', fontSize: 24 }}>
          Iphigen<span className="amp" style={{ color: 'var(--accent-3)' }}>AI</span>
        </div>
        <div>
          <div className="login-shell__art-title">
            Un tutor che <em>ti conosce,</em><br />
            giorno dopo giorno.
          </div>
          <div className="login-shell__art-sub">
            Lo studio ha una memoria. Ogni sessione riprende da dove eri rimasto — senza doverlo spiegare di nuovo.
          </div>
        </div>
        <div style={{ fontFamily: 'var(--hand)', fontSize: 14, opacity: 0.6 }}>
          versione prototipo · aprile 2026
        </div>
      </div>
      <div className="login-shell__form">
        <h1>Entra</h1>
        <p className="lead">
          Usa le credenziali che ti hanno mandato. Se le hai perse, scrivi a chi ti segue.
        </p>

        <div className="login-role">
          <button type="button" className={role === 'student' ? 'on' : ''} onClick={() => quickFill('student')}>Studente</button>
          <button type="button" className={role === 'tutor' ? 'on' : ''} onClick={() => quickFill('tutor')}>Tutor</button>
          <button type="button" className={role === 'admin' ? 'on' : ''} onClick={() => quickFill('admin')}>Admin</button>
        </div>

        <form onSubmit={submit}>
          <div className="form-field">
            <label>Nome utente</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              {error}
            </div>
          )}
          <button className="btn btn--primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? 'un attimo…' : 'entra →'}
          </button>
        </form>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed var(--ink-faint)', fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--hand)' }}>
          demo · prova con <strong>luca / luca2026</strong>, <strong>chiara / chiara2026</strong> oppure <strong>admin / admin2026</strong>
        </div>
      </div>
    </div>
  );
}

window.LoginPage = LoginPage;
