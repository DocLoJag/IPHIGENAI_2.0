/* Chat con tutor AI (fullscreen) */
function AIChatPage({ user, showToast }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await api.get('/ai/threads/current');
      setThread(t);
      setLoading(false);
    })();
  }, []);

  const onSend = async (text) => {
    if (!thread) return;
    setSending(true);
    // ottimistico
    const optimistic = {
      id: 'tmp-' + Date.now(),
      from: 'student',
      text,
      at: new Date().toISOString(),
    };
    setThread((t) => ({ ...t, messages: [...t.messages, optimistic] }));
    try {
      const res = await api.post(`/ai/threads/${thread.id}/message`, { text });
      setThread((t) => {
        const cleaned = t.messages.filter((m) => m.id !== optimistic.id);
        return { ...t, messages: [...cleaned, ...res.messages] };
      });
    } catch (e) {
      showToast('Errore: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading || !thread) {
    return <div className="chat"><div className="chat__head">un attimo…</div></div>;
  }

  const msgs = thread.messages.map((m) => ({
    ...m,
    from_name: m.from === 'ai' ? 'il tutor' : 'tu',
  }));

  return (
    <ChatScreen
      title="Tutor"
      subtitle={`stiamo ripassando ${thread.topic?.toLowerCase() || ''} · per la verifica di mercoledì`}
      avatarInitial="AI"
      avatarClass=""
      messages={msgs}
      meId="student"
      onSend={onSend}
      onBack={() => navigate('/home')}
    />
  );
}

window.AIChatPage = AIChatPage;
