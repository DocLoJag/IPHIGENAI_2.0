/* Admin home — pannello: lista utenti + CRUD + reset demo + logout.
 *
 * Backend espone già da inizio progetto POST/GET/PUT/DELETE su /admin/users
 * e POST /admin/reset-demo. La UI rendeva fino al 2026-04-25 solo lista +
 * reset; questa pass aggiunge crea/modifica/elimina inline così l'admin
 * non deve più passare da curl per gestire utenti reali.
 */
function AdminHomePage({ user, showToast }) {
  const { useState, useEffect } = React;

  const [users, setUsers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const create = async (payload) => {
    await api.post('/admin/users', payload);
    showToast('Utente creato.');
    setCreating(false);
    await reload();
  };

  const byRole = (role) => (users || []).filter((u) => u.role === role);
  const tutors = byRole('tutor');

  return (
    <div className="page paper-grain">
      <div style={{ marginBottom: 26 }}>
        <Greeting
          name={user.name}
          sub="Pannello di servizio. Da qui puoi gestire gli utenti del pilota e rimettere la demo allo stato iniziale."
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
          {!creating && (
            <button
              className="btn btn--ghost"
              onClick={() => setCreating(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              + nuovo utente
            </button>
          )}
        </div>

        {creating && (
          <UserForm
            tutors={tutors}
            onSubmit={create}
            onCancel={() => setCreating(false)}
            submitLabel="crea utente"
          />
        )}

        {loadErr ? (
          <div className="card">{loadErr}</div>
        ) : users === null ? (
          <div className="card card--soft" style={{ textAlign: 'center', padding: 24 }}>
            <span className="soft">caricamento…</span>
          </div>
        ) : (
          <>
            <UserGroup label="Studenti" users={byRole('student')} tutors={tutors} onChanged={reload} showToast={showToast} currentUserId={user.id} />
            <UserGroup label="Tutor" users={byRole('tutor')} tutors={tutors} onChanged={reload} showToast={showToast} currentUserId={user.id} />
            <UserGroup label="Admin" users={byRole('admin')} tutors={tutors} onChanged={reload} showToast={showToast} currentUserId={user.id} />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── UserForm: crea o modifica un utente ────────────────────────
 * In modalità crea (initial null) chiede tutti i campi obbligatori:
 *   role, username, password, name. Se role=student, mostra anche
 *   grade, school, tutor_id (select fra i tutor esistenti).
 * In modalità modifica (initial != null), role e username non sono
 * editabili (li mostriamo come pill informative); password è opzionale
 * (vuoto = invariato). Per gli student si possono aggiornare grade,
 * school, tutor_id.
 */
function UserForm({ initial, tutors, onSubmit, onCancel, submitLabel }) {
  const { useState } = React;
  const isEdit = !!initial;
  const role = isEdit ? initial.role : 'student';
  const [roleSel, setRoleSel] = useState('student');
  const effectiveRole = isEdit ? role : roleSel;

  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(initial?.name || '');
  const [fullName, setFullName] = useState(initial?.full_name || '');
  const [avatarInitial, setAvatarInitial] = useState(initial?.avatar_initial || '');
  const [grade, setGrade] = useState(initial?.grade || '');
  const [school, setSchool] = useState(initial?.school || '');
  const [tutorId, setTutorId] = useState(initial?.tutor_id || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!isEdit) {
      if (!username.trim() || !password || !name.trim()) {
        setErr('Compila role, username, password, nome.');
        return;
      }
    }
    if (isEdit && !name.trim()) {
      setErr('Il nome non può essere vuoto.');
      return;
    }

    const payload = {};
    if (!isEdit) {
      payload.role = effectiveRole;
      payload.username = username.trim();
      payload.password = password;
      payload.name = name.trim();
      if (fullName.trim()) payload.full_name = fullName.trim();
      if (avatarInitial.trim()) payload.avatar_initial = avatarInitial.trim();
    } else {
      // PUT: solo i campi cambiati / non vuoti per password
      if (password) payload.password = password;
      if (name.trim() !== (initial.name || '')) payload.name = name.trim();
      if (fullName !== (initial.full_name || '')) payload.full_name = fullName;
      if (avatarInitial !== (initial.avatar_initial || '')) payload.avatar_initial = avatarInitial;
    }
    if (effectiveRole === 'student') {
      if (!isEdit) {
        if (grade.trim()) payload.grade = grade.trim();
        if (school.trim()) payload.school = school.trim();
        if (tutorId) payload.tutor_id = tutorId;
      } else {
        if (grade !== (initial.grade || '')) payload.grade = grade;
        if (school !== (initial.school || '')) payload.school = school;
        if (tutorId !== (initial.tutor_id || '')) payload.tutor_id = tutorId;
      }
    }

    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (e2) {
      setErr(e2.message || 'Errore');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card--soft" style={{ padding: 14, marginBottom: 14 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 140px' }}>
          ruolo
          {isEdit ? (
            <span className="pill" style={{ alignSelf: 'flex-start' }}>{role}</span>
          ) : (
            <select className="input" value={roleSel} onChange={(e) => setRoleSel(e.target.value)}>
              <option value="student">studente</option>
              <option value="tutor">tutor</option>
              <option value="admin">admin</option>
            </select>
          )}
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 200px' }}>
          username
          {isEdit ? (
            <span className="pill" style={{ alignSelf: 'flex-start' }}>@{initial.username}</span>
          ) : (
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="es. mario.rossi"
              autoComplete="off"
            />
          )}
        </label>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 200px' }}>
          nome breve
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Mario" />
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '3 1 240px' }}>
          nome completo (opzionale)
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="es. Mario Rossi" />
        </label>
        <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 1 80px' }}>
          iniz. avatar
          <input className="input" value={avatarInitial} onChange={(e) => setAvatarInitial(e.target.value)} maxLength={2} placeholder="M" />
        </label>
      </div>

      <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        password{isEdit ? ' (lascia vuoto per non cambiare)' : ' (min 6 caratteri)'}
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={isEdit ? '••••••' : ''}
        />
      </label>

      {effectiveRole === 'student' && (
        <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 160px' }}>
            classe (opzionale)
            <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="es. Quarta scientifico" />
          </label>
          <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 220px' }}>
            scuola (opzionale)
            <input className="input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="es. Liceo G. Galilei" />
          </label>
          <label className="hand small muted" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 200px' }}>
            tutor assegnato
            <select className="input" value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
              <option value="">— nessuno —</option>
              {(tutors || []).map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.name} (@{t.username})</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {err && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{err}</div>
      )}

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>annulla</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function UserGroup({ label, users, tutors, onChanged, showToast, currentUserId }) {
  if (!users || users.length === 0) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="hand small muted" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {users.map((u) => (
          <UserCard
            key={u.id}
            u={u}
            tutors={tutors}
            onChanged={onChanged}
            showToast={showToast}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

function UserCard({ u, tutors, onChanged, showToast, currentUserId }) {
  const { useState } = React;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = u.id === currentUserId;

  const tutorName = u.tutor_id
    ? (tutors.find((t) => t.id === u.tutor_id)?.full_name
       || tutors.find((t) => t.id === u.tutor_id)?.name
       || u.tutor_id)
    : null;

  const update = async (payload) => {
    await api.put(`/admin/users/${u.id}`, payload);
    showToast('Utente aggiornato.');
    setEditing(false);
    await onChanged();
  };

  const remove = async () => {
    if (isSelf) {
      showToast('Non puoi disattivare te stesso.');
      return;
    }
    const label = u.full_name || u.name;
    if (!confirm(`Disattivare l'utente "${label}" (@${u.username})?\nL'utente non potrà più fare login.`)) return;
    setBusy(true);
    try {
      await api.del(`/admin/users/${u.id}`);
      showToast('Utente disattivato.');
      await onChanged();
    } catch (e) {
      showToast(`Errore: ${e.message || 'eliminazione fallita'}`);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <UserForm
        initial={u}
        tutors={tutors}
        onSubmit={update}
        onCancel={() => setEditing(false)}
        submitLabel="salva modifiche"
      />
    );
  }

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="row row--between" style={{ alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={
            'avatar ' + (u.role === 'tutor' ? 'avatar--muschio' : u.role === 'admin' ? 'avatar--terra' : '')
          }>{u.avatar_initial}</span>
          <div>
            <div style={{ fontFamily: 'var(--title)', fontSize: 18 }}>
              {u.full_name || u.name}
              {isSelf && <span className="hand small muted" style={{ marginLeft: 8 }}>(tu)</span>}
            </div>
            <div className="soft" style={{ fontSize: 13 }}>
              @{u.username}
              {u.grade ? ` · ${u.grade}` : ''}
              {u.school ? ` · ${u.school}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="soft small" style={{ textAlign: 'right' }}>
            <div>{u.role}</div>
            {tutorName ? <div style={{ fontFamily: 'var(--hand)' }}>tutor: {tutorName}</div> : null}
          </div>
          <div className="row" style={{ gap: 4 }}>
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
              disabled={busy || isSelf}
              onClick={remove}
              title={isSelf ? 'non puoi disattivare te stesso' : 'disattiva utente (soft delete)'}
              style={{ fontSize: 12, padding: '4px 10px', color: isSelf ? undefined : 'var(--danger)' }}
            >
              {busy ? '…' : 'disattiva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
