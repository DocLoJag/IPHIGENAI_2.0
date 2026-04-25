/* Admin home — pannello minimale: lista utenti + reset demo + logout.
 *
 * Per il pilota l'admin non ha bisogno di una UI ricca: serve solo a (a)
 * vedere chi ci sta dentro e (b) ripulire lo stato della demo dopo un
 * test/dimostrazione. Il backend espone /admin/users (lista) e
 * /admin/reset-demo (distruttivo). Niente create/edit/delete via UI in
 * questa tranche minima — restano via curl finché non emerge richiesta.
 */
function AdminHomePage({ user, showToast }) {
  const { useState, useEffect } = React;

  const [users, setUsers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const reload = async () => {
    try {
      setLoadErr(null);
      const res = await api.get('/admin/users');
      setUsers(res.users);
    } catch (e) {
      setLoadErr(e.message || 'Errore nel caricamento utenti');
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onResetClick = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      // 4s per cliccare la conferma — dopo torna allo stato iniziale.
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setResetting(true);
    try {
      await api.post('/admin/reset-demo', {});
      showToast('Demo rimessa al seed iniziale.');
      await reload();
    } catch (e) {
      showToast(`Reset fallito: ${e.message || 'errore'}`);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const byRole = (role) => (users || []).filter((u) => u.role === role);

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 26 }}>
        <Greeting
          name={user.name}
          sub="Pannello di servizio. Da qui puoi vedere gli utenti del pilota e rimettere la demo allo stato iniziale."
          size="lg"
        />
      </div>

      {/* Reset demo */}
      <div className="card card--cream" style={{ marginBottom: 24 }}>
        <div className="row row--between" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div style={{ maxWidth: 540 }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Reset demo</h2>
            <p className="soft" style={{ fontSize: 14, lineHeight: 1.5 }}>
              Riporta tutto lo stato del pilota al seed iniziale: la sessione di matematica
              di Luca torna in pausa, le proposte del curator riappaiono, la chat AI
              torna ai 3 messaggi seed, eventuali allegati caricati vengono cancellati
              (DB + GridFS). <strong>Distruttivo.</strong>
            </p>
          </div>
          <button
            className="btn"
            onClick={onResetClick}
            disabled={resetting}
            style={{
              minWidth: 180,
              background: confirmReset ? 'var(--accent)' : undefined,
              color: confirmReset ? 'white' : undefined,
            }}
          >
            {resetting ? 'reset in corso…' : confirmReset ? 'sicuro? clicca ancora' : 'reset al seed'}
          </button>
        </div>
      </div>

      {/* Lista utenti */}
      <div style={{ marginTop: 28 }}>
        <div className="row row--between" style={{ marginBottom: 14, borderBottom: '1.5px solid var(--ink)', paddingBottom: 8 }}>
          <h2 style={{ fontSize: 22 }}>Utenti</h2>
          <span className="hand small muted">solo lettura per ora</span>
        </div>

        {loadErr ? (
          <div className="card">{loadErr}</div>
        ) : users === null ? (
          <div className="card card--soft" style={{ textAlign: 'center', padding: 24 }}>
            <span className="soft">caricamento…</span>
          </div>
        ) : (
          <>
            <UserGroup label="Studenti" users={byRole('student')} />
            <UserGroup label="Tutor" users={byRole('tutor')} />
            <UserGroup label="Admin" users={byRole('admin')} />
          </>
        )}
      </div>
    </div>
  );
}

function UserGroup({ label, users }) {
  if (!users || users.length === 0) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="hand small muted" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {users.map((u) => (
          <div key={u.id} className="card" style={{ padding: '12px 16px' }}>
            <div className="row row--between" style={{ alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={
                  'avatar ' + (u.role === 'tutor' ? 'avatar--muschio' : u.role === 'admin' ? 'avatar--terra' : '')
                }>{u.avatar_initial}</span>
                <div>
                  <div style={{ fontFamily: 'var(--title)', fontSize: 18 }}>
                    {u.full_name || u.name}
                  </div>
                  <div className="soft" style={{ fontSize: 13 }}>
                    @{u.username}
                    {u.grade ? ` · ${u.grade}` : ''}
                    {u.school ? ` · ${u.school}` : ''}
                  </div>
                </div>
              </div>
              <div className="soft small" style={{ textAlign: 'right' }}>
                <div>{u.role}</div>
                {u.tutor_id ? <div style={{ fontFamily: 'var(--hand)' }}>tutor: {u.tutor_id}</div> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
