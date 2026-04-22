/* Chat con Chiara (tutor umana) */
function ChiaraChatPage({ user, showToast }) {
  const threadId = 'thread-luca-chiara';
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await api.get(`/threads/${threadId}`);
      setThread(t);
      setLoading(false);
    })();
  }, []);

  const onSend = async (text) => {
    const optimistic = {
      id: 'tmp-' + Date.now(),
      from: user.id,
      kind: user.role === 'tutor' ? 'tutor' : 'student',
      at: new Date().toISOString(),
      text,
    };
    setThread((t) => ({ ...t, messages: [...t.messages, optimistic] }));
    try {
      const res = await api.post(`/threads/${threadId}/message`, { text });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === optimistic.id ? res.message : m)),
      }));
    } catch (e) {
      showToast('Errore: ' + e.message);
    }
  };

  if (loading || !thread) return <div className="chat"><div className="chat__head">un attimo…</div></div>;

  const meId = user.id;
  const otherName = user.role === 'tutor' ? 'Luca' : 'Chiara';
  const avatar = user.role === 'tutor' ? 'L' : 'C';
  const msgs = thread.messages.map((m) => ({
    ...m,
    from_name: m.kind === 'tutor' ? 'Chiara' : 'Luca',
  }));

  return (
    <ChatScreen
      title={otherName}
      subtitle={user.role === 'tutor' ? 'il tuo studente · quarta scientifico' : 'il tuo tutor umano'}
      avatarInitial={avatar}
      avatarClass="avatar--muschio"
      messages={msgs}
      meId={meId}
      onSend={onSend}
      onBack={() => navigate('/home')}
    />
  );
}

window.ChiaraChatPage = ChiaraChatPage;
