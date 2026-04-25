/* Chat con tutor AI (fullscreen) — risposta in streaming via SSE. */
function AIChatPage({ user, showToast }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    (async () => {
      const t = await api.get('/ai/threads/current');
      setThread(t);
      setLoading(false);
    })();
    return () => {
      // se l'utente naviga via mentre lo stream è in corso, chiudilo
      if (streamRef.current) streamRef.current.abort();
    };
  }, []);

  const onSend = async (text) => {
    if (!thread || sending) return;
    setSending(true);

    const optimisticStudentId = 'tmp-student-' + Date.now();
    const aiPlaceholderId = 'tmp-ai-' + Date.now();

    // Spingiamo subito la bolla studente + un placeholder AI vuoto in stato "streaming".
    setThread((t) => ({
      ...t,
      messages: [
        ...t.messages,
        { id: optimisticStudentId, from: 'student', at: new Date().toISOString(), text },
        { id: aiPlaceholderId, from: 'ai', at: new Date().toISOString(), text: '', streaming: true },
      ],
    }));

    const replaceMessage = (predicate, replacer) =>
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => (predicate(m) ? replacer(m) : m)),
      }));

    streamRef.current = api.stream(`/ai/threads/${thread.id}/stream`, { text }, {
      onEvent: (name, data) => {
        if (name === 'student') {
          // sostituisci l'ottimistico con il messaggio persistito (id stabile)
          replaceMessage(
            (m) => m.id === optimisticStudentId,
            () => ({ id: data.id, from: 'student', at: data.at, text: data.text }),
          );
        } else if (name === 'delta' && typeof data.text === 'string') {
          replaceMessage(
            (m) => m.id === aiPlaceholderId,
            (m) => ({ ...m, text: (m.text || '') + data.text }),
          );
        } else if (name === 'done') {
          replaceMessage(
            (m) => m.id === aiPlaceholderId,
            () => ({ id: data.id, from: 'ai', at: data.at, text: data.text, streaming: false }),
          );
        } else if (name === 'error') {
          showToast('Errore: ' + (data && data.message ? data.message : 'risposta interrotta'));
          // rimuovi il placeholder AI: lo studente vede comunque la sua bolla
          setThread((t) => ({
            ...t,
            messages: t.messages.filter((m) => m.id !== aiPlaceholderId),
          }));
        }
      },
      onError: (err) => {
        showToast('Errore: ' + err.message);
        setThread((t) => ({
          ...t,
          messages: t.messages.filter((m) => m.id !== aiPlaceholderId),
        }));
      },
      onClose: () => {
        streamRef.current = null;
        setSending(false);
        // se il done è arrivato il placeholder è già stato sostituito;
        // se invece lo stream si è chiuso senza done, lascia visibile quel che c'è.
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
        }));
      },
    });
  };

  if (loading || !thread) {
    return <div className="chat"><div className="chat__head">un attimo…</div></div>;
  }

  const msgs = thread.messages.map((m) => ({
    ...m,
    text: m.streaming && !m.text ? '…' : m.text,
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
