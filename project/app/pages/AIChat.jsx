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

  const onSend = async (text, attachment) => {
    if (!thread || sending) return;
    if (!text && !attachment) return;
    setSending(true);

    // Allegato (§8.6 st2): finché il backend del messaggio AI non accetta
    // attachment_ids (st3 — integrazione con content blocks Anthropic),
    // appendiamo l'URL al testo del messaggio. Lo studente vede il link
    // cliccabile nella propria bolla; il file resta accessibile via /uploads.
    const fullText = attachment
      ? (text ? text + '\n\n' : '') + `📎 ${attachment.filename} — ${attachment.url}`
      : text;

    // Optimistic: appendiamo subito il messaggio studente con id provvisorio.
    // Verrà sostituito dall'id definitivo quando arriva l'evento `meta` dal server.
    const tmpUserId = 'tmp-user-' + Date.now();
    setThread((t) => ({
      ...t,
      messages: [
        ...t.messages,
        { id: tmpUserId, from: 'student', text: fullText, at: new Date().toISOString() },
      ],
    }));

    let aiPlaceholderId = null;

    try {
      await api.stream(
        `/ai/threads/${thread.id}/message/stream`,
        { text: fullText },
        {
          meta: ({ student, ai }) => {
            aiPlaceholderId = ai.id;
            // Sostituisci l'optimistic con i record definitivi e aggiungi
            // il placeholder AI vuoto che riempiremo via `delta`.
            setThread((t) => ({
              ...t,
              messages: [
                ...t.messages.filter((m) => m.id !== tmpUserId),
                student,
                { id: ai.id, from: 'ai', at: ai.at, text: '' },
              ],
            }));
          },
          delta: ({ text: chunk }) => {
            if (!aiPlaceholderId) return;
            setThread((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === aiPlaceholderId ? { ...m, text: m.text + chunk } : m,
              ),
            }));
          },
          done: ({ message }) => {
            // Sostituisci il placeholder col messaggio finale (id stabile + at backend).
            setThread((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === aiPlaceholderId ? message : m,
              ),
            }));
            aiPlaceholderId = message.id;
          },
          error: (e) => {
            showToast('Errore streaming: ' + (e.message || 'interrotto'));
            // Rimuovi placeholder AI parziale; il messaggio studente è già
            // persistito lato server, quindi resta.
            setThread((t) => ({
              ...t,
              messages: t.messages.filter((m) => m.id !== aiPlaceholderId),
            }));
          },
        },
      );
    } catch (streamErr) {
      // Streaming non disponibile (es. 404 se non deployato o errore di rete
      // prima dell'apertura): fallback al POST sync. Il messaggio studente
      // resta tra gli optimistic; lo rimuoviamo prima del fallback per
      // evitare doppioni.
      console.warn('[chat] streaming fallito, fallback sync:', streamErr.message);
      setThread((t) => ({
        ...t,
        messages: t.messages.filter(
          (m) => m.id !== tmpUserId && m.id !== aiPlaceholderId,
        ),
      }));
      try {
        const res = await api.post(`/ai/threads/${thread.id}/message`, { text: fullText });
        setThread((t) => ({ ...t, messages: [...t.messages, ...res.messages] }));
      } catch (e) {
        showToast('Errore: ' + e.message);
      }
    } finally {
      setSending(false);
    }
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
      enableAttach={true}
      studentIdForUpload={user?.role === 'student' ? user.id : null}
      showToast={showToast}
    />
  );
}

window.AIChatPage = AIChatPage;
