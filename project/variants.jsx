// Wireframe variants for IphigenAI student home
// Low-fi, sketchy, b&w + terracotta/muschio accents, paper feel.

const { useState } = React;

/* ─────────────────────────────────────────────
   SHARED PARTS
   ───────────────────────────────────────────── */

function TopBar({ mode = 'Compatto', showMode = true, logo = true }) {
  return (
    <div className="wf-topbar">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        {logo && <div className="wf-logo">Iphigen<span className="amp">AI</span></div>}
        <span style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-faint)' }}>
          martedì 22 aprile
        </span>
      </div>
      {showMode && (
        <div className="wf-mode-switch">
          <span className={mode === 'Compatto' ? 'on' : ''}>Compatto</span>
          <span className={mode === 'Disteso' ? 'on' : ''}>Disteso</span>
        </div>
      )}
    </div>
  );
}

function Greeting({ size = 'md', style = {} }) {
  const sizes = { sm: 28, md: 40, lg: 56 };
  return (
    <div style={{ ...style }}>
      <div style={{ fontFamily: 'var(--title)', fontSize: sizes[size], lineHeight: 1.05, letterSpacing: '-0.015em' }}>
        Buongiorno, Luca.
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: 15, marginTop: 6 }}>
        Quarta scientifico · mercoledì hai matematica.
      </div>
    </div>
  );
}

function Constellation({ compact = false }) {
  // Simple SVG constellation — dots + lines, handdrawn vibe
  const W = 360, H = 260;
  const nodes = [
    { x: 70, y: 60, r: 8, tone: 'ink', label: 'Funzioni' },
    { x: 140, y: 30, r: 10, tone: 'accent', label: 'Equazioni 2°' },
    { x: 220, y: 70, r: 6, tone: 'ink', label: 'Geometria' },
    { x: 290, y: 45, r: 5, tone: 'faint', label: 'Logaritmi' },
    { x: 100, y: 130, r: 7, tone: 'muschio', label: 'Promessi Sposi' },
    { x: 190, y: 150, r: 9, tone: 'ink', label: 'Leopardi' },
    { x: 280, y: 130, r: 6, tone: 'ocra', label: 'Dante' },
    { x: 60, y: 210, r: 5, tone: 'faint', label: 'Storia' },
    { x: 160, y: 225, r: 6, tone: 'ink', label: 'Filosofia' },
    { x: 250, y: 205, r: 7, tone: 'muschio', label: 'Inglese' },
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [7, 8], [8, 9], [0, 4], [2, 6]
  ];
  const toneFill = { ink: '#1a1816', accent: '#b54a1f', muschio: '#5a6b3a', ocra: '#d9a441', faint: '#bab2a4' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="#8a837b" strokeWidth="1" strokeDasharray="2 3" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={toneFill[n.tone]} />
          {!compact && (
            <text x={n.x + n.r + 4} y={n.y + 3}
              fontSize="9" fontFamily="Kalam, cursive" fill="#3a3632">
              {n.label}
            </text>
          )}
        </g>
      ))}
      {/* Legend */}
      {!compact && (
        <g transform="translate(0, 250)">
          <circle cx="6" cy="0" r="4" fill="#b54a1f" />
          <text x="14" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">lavorato ieri</text>
          <circle cx="96" cy="0" r="4" fill="#1a1816" />
          <text x="104" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">consolidato</text>
          <circle cx="186" cy="0" r="4" fill="#bab2a4" />
          <text x="194" y="3" fontSize="9" fontFamily="Inter" fill="#3a3632">da ripassare</text>
        </g>
      )}
    </svg>
  );
}

/* ─── Bolla Tutor AI (desktop + mobile coerenti) → apre chat fullscreen ─── */
function FloatingChats({ variant = 'desktop', expanded = false }) {
  const isDesktop = variant === 'desktop';

  if (expanded) {
    // Chat fullscreen
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: 'var(--paper-cream)',
        display: 'flex', flexDirection: 'column',
        color: 'var(--ink)'
      }}>
        {/* header fullscreen */}
        <div style={{
          padding: isDesktop ? '18px 36px' : '14px 18px',
          borderBottom: '1.5px solid var(--ink)',
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--paper)'
        }}>
          <div style={{ fontSize: 22, opacity: 0.7, cursor: 'pointer', lineHeight: 1 }}>←</div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--paper-cream)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--title)', fontSize: 17, fontStyle: 'italic'
          }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Tutor</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--hand)' }}>
              stiamo ripassando le equazioni · per la verifica di mercoledì
            </div>
          </div>
        </div>

        {/* messaggi */}
        <div style={{
          flex: 1,
          padding: isDesktop ? '28px 15% 28px' : '20px 18px',
          display: 'flex', flexDirection: 'column', gap: 16,
          overflow: 'auto'
        }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: isDesktop ? 16 : 14, lineHeight: 1.55,
              color: 'var(--ink)',
              background: 'var(--paper)',
              border: '1.2px solid var(--ink-faint)',
              padding: '14px 18px', borderRadius: 16
            }}>
              "Ciao Luca. Ripartiamo da dove eri ieri? Il delta ti ha dato qualche difficoltà quando il coefficiente era negativo. Ti propongo un esempio nuovo, piano."
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6, marginLeft: 4, fontFamily: 'var(--hand)' }}>
              il tutor · ora
            </div>
          </div>

          <div style={{
            alignSelf: 'flex-end', maxWidth: '65%',
            fontSize: isDesktop ? 15 : 13.5, lineHeight: 1.4,
            background: 'var(--ink)', color: 'var(--paper-cream)',
            padding: '12px 16px', borderRadius: 16
          }}>
            ok, proviamo con un esempio nuovo
          </div>

          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: isDesktop ? 16 : 14, lineHeight: 1.55,
              color: 'var(--ink)',
              background: 'var(--paper)',
              border: '1.2px solid var(--ink-faint)',
              padding: '14px 18px', borderRadius: 16
            }}>
              "Bene. Prendiamo <span style={{ fontStyle: 'normal', fontFamily: 'var(--title)' }}>−2x² + 3x + 1 = 0</span>. Prima di partire, qual è il segno di <span style={{ fontStyle: 'normal', fontFamily: 'var(--title)' }}>a</span>?"
            </div>
          </div>
        </div>

        {/* composer */}
        <div style={{
          padding: isDesktop ? '14px 15% 22px' : '12px 16px 18px',
          borderTop: '1.5px solid var(--ink)',
          background: 'var(--paper)'
        }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '12px 18px',
            border: '1.2px solid var(--ink)',
            borderRadius: 999,
            background: 'var(--paper-cream)'
          }}>
            <span style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: isDesktop ? 14 : 13,
              color: 'var(--ink-faint)', flex: 1
            }}>
              scrivi al tutor…
            </span>
            <span style={{ color: 'var(--ink)', opacity: 0.6 }}>↑</span>
          </div>
        </div>
      </div>
    );
  }

  // Bolla a riposo — tutor AI soltanto. Trattata come un "segnalibro"
  // rettangolare, coerente con le card della pagina, non come bubble SaaS.
  const pos = isDesktop
    ? { position: 'absolute', bottom: 28, right: 36, zIndex: 20 }
    : { position: 'absolute', bottom: 20, right: 18, zIndex: 20 };

  return (
    <div style={pos}>
      <div style={{
        background: 'var(--paper)', border: '1.5px solid var(--ink)',
        borderRadius: 10, padding: '8px 14px 8px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 3px 0 rgba(26,24,22,0.12)',
        cursor: 'pointer'
      }}>
        <div style={{
          width: 28, height: 28,
          background: 'var(--ink)', color: 'var(--paper-cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--title)', fontSize: 13, fontStyle: 'italic',
          borderRadius: 4,
          flexShrink: 0
        }}>AI</div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{
            fontFamily: 'var(--title)', fontSize: 14, color: 'var(--ink)',
            letterSpacing: '-0.005em'
          }}>Parla con il tutor</div>
          <div style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 11.5, color: 'var(--ink-faint)'
          }}>
            chiedi qualcosa, o continua da dove eri
          </div>
        </div>
      </div>
    </div>
  );
}
function TutorAIEntry() {
  return (
    <div className="wf-box wf-box--cream" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--title)', fontSize: 17 }}>Parla con il tutor</div>
        <span className="wf-tag">si adatta alla materia</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1.2px solid var(--ink-faint)', borderRadius: 999, background: '#fff' }}>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-faint)' }}>
          scrivi una domanda, o scegli di cosa parlare…
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="wf-pill">matematica</span>
        <span className="wf-pill">italiano</span>
        <span className="wf-pill">test d'ingresso</span>
        <span className="wf-pill">qualcos'altro…</span>
      </div>
    </div>
  );
}

function TutorHuman({ compact = false }) {
  return (
    <div className="wf-box wf-box--warm" style={{ padding: compact ? '10px 12px' : '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: '50%',
          background: 'var(--accent-2)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--title)', fontSize: compact ? 12 : 14, flexShrink: 0
        }}>C</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, lineHeight: 1.15 }}>Chiara, il tuo tutor</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>ieri, 22:14</div>
        </div>
      </div>
      <div className="wf-tutor-msg" style={{ marginTop: 6, padding: compact ? '8px 10px' : undefined }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: compact ? 12 : 13, fontStyle: 'italic', lineHeight: 1.4 }}>
          {compact
            ? '"Ho messo due esercizi in più per mercoledì, fammi sapere se il passaggio al delta ti torna."'
            : '"Ieri sera sei andato bene sulle equazioni. Ho messo due esercizi in più per mercoledì, fammi sapere se trovi il passaggio al delta meno naturale."'}
        </div>
      </div>
      {!compact && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--ink-faint)' }}>
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', border: '1.2px solid var(--ink-faint)', borderRadius: 8, background: '#fff' }}>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              scrivi a Chiara…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Cronologia messaggi Chiara — inline sotto al buongiorno,
   espandibile. Collassato: anteprima dell'ultimo messaggio su una riga.
   Aperto: elenco cronologico con i messaggi di Luca e Chiara. ─── */
function ChiaraThread() {
  const [open, setOpen] = useState(false);

  const history = [
    { when: 'ieri, 22:14', from: 'Chiara', kind: 'tutor',
      text: '"Ho messo due esercizi in più per mercoledì, fammi sapere se il passaggio al delta ti torna."' },
    { when: 'ieri, 21:50', from: 'Luca', kind: 'me',
      text: '"Ok, domani mattina ci riprovo. Il terzo non mi è uscito."' },
    { when: 'ieri, 21:42', from: 'Chiara', kind: 'tutor',
      text: '"Benissimo sulla formula. Se vuoi, ti lascio uno scalino più morbido per il coefficiente negativo."' },
    { when: 'lun, 18:20', from: 'Chiara', kind: 'tutor',
      text: '"Stasera proviamo a fare due esercizi insieme — niente verifica, solo per prendere confidenza."' },
  ];

  const latest = history[0];

  return (
    <div style={{
      marginTop: 14,
      border: '1.5px solid var(--ink)',
      borderRadius: 10,
      background: 'var(--paper)',
      overflow: 'hidden'
    }}>
      {/* riga sempre visibile — anteprima ultimo messaggio, cliccabile */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', color: 'var(--ink)', font: 'inherit'
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-2)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--title)', fontSize: 13
        }}>C</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, color: 'var(--ink-faint)',
            fontFamily: 'var(--hand)', marginBottom: 1
          }}>
            Chiara, il tuo tutor · {latest.when}
          </div>
          <div style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 13.5, lineHeight: 1.35, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: open ? 'normal' : 'nowrap'
          }}>
            {latest.text}
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--ink-faint)',
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4
        }}>
          {open ? 'chiudi' : 'cronologia'}
          <span style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease'
          }}>▾</span>
        </span>
      </button>

      {/* cronologia espansa */}
      {open && (
        <div style={{
          borderTop: '1px dashed var(--ink-faint)',
          padding: '14px 16px 14px',
          background: 'var(--paper-cream)',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          {history.map((m, i) => {
            const mine = m.kind === 'me';
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start'
              }}>
                <div style={{ maxWidth: '78%' }}>
                  <div style={{
                    fontSize: 10.5, color: 'var(--ink-faint)',
                    fontFamily: 'var(--hand)', marginBottom: 3,
                    textAlign: mine ? 'right' : 'left'
                  }}>
                    {m.from} · {m.when}
                  </div>
                  <div style={{
                    fontFamily: 'var(--serif)', fontStyle: 'italic',
                    fontSize: 13, lineHeight: 1.4,
                    padding: '8px 12px',
                    border: mine ? 'none' : '1.2px solid var(--ink-faint)',
                    background: mine ? 'var(--ink)' : 'var(--paper)',
                    color: mine ? 'var(--paper-cream)' : 'var(--ink)',
                    borderRadius: 12
                  }}>
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })}

          {/* composer inline, stesso linguaggio della chat del tutor AI */}
          <div style={{
            marginTop: 2,
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '8px 14px',
            border: '1.2px solid var(--ink)',
            borderRadius: 999,
            background: 'var(--paper)'
          }}>
            <span style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: 13, color: 'var(--ink-faint)', flex: 1
            }}>
              scrivi a Chiara…
            </span>
            <span style={{ color: 'var(--ink)', opacity: 0.6 }}>↑</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   VARIANT A — Scrivania editoriale
   (griglia asimmetrica, "dove eri rimasto" domina)
   ───────────────────────────────────────────── */

function VariantA() {
  return (
    <div className="wf">
      <div className="wf-inner">
        <TopBar mode="Compatto" />

        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Greeting size="lg" />
          <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--ink-faint)', textAlign: 'right' }}>
            <div style={{ color: 'var(--accent)', fontSize: 18 }}>↓ riprendi subito</div>
            <div>oppure guardati intorno</div>
          </div>
        </div>

        <div className="vA-grid">
          {/* RESUME — grande, domina */}
          <div className="vA-resume">
            <div className="wf-box" style={{ padding: 0, overflow: 'hidden', background: 'var(--paper)' }}>
              <div style={{ padding: '22px 26px 20px', borderBottom: '1.5px solid var(--ink)' }}>
                <div className="wf-tag" style={{ marginBottom: 6 }}>ieri sera, 22:14 — dove eri rimasto</div>
                <div style={{ fontFamily: 'var(--title)', fontSize: 34, lineHeight: 1.08, letterSpacing: '-0.015em', marginBottom: 10 }}>
                  Equazioni di secondo grado, il momento del delta.
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 520 }}>
                  "Eri arrivato al terzo esercizio. Hai capito la formula, ma quando il coefficiente era negativo ti fermavi. Riprendiamo da lì — stavolta più piano."
                </div>
              </div>

              <div style={{ padding: '16px 26px', display: 'flex', gap: 18, alignItems: 'center' }}>
                <div className="wf-placeholder" style={{ width: 120, height: 80 }}>
                  foglio di lavoro<br />
                  (snapshot)
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>3 di 5 esercizi · 24 minuti</div>
                  <div style={{ height: 6, background: 'var(--paper-edge)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: 'var(--accent)' }} />
                  </div>
                </div>
                <button style={{
                  border: '1.5px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper-cream)',
                  fontFamily: 'var(--title)', fontSize: 15, padding: '10px 18px', borderRadius: 999, cursor: 'pointer'
                }}>riprendi →</button>
              </div>
            </div>

            {/* Annotazione handdrawn */}
            <div className="wf-annot" style={{ top: -14, right: -8, transform: 'rotate(4deg)' }}>
              ← scheda dominante,<br />
              risolve il foglio bianco
            </div>
          </div>

          {/* ATTESE — card tipo articoli */}
          <div className="vA-attese">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 22 }}>Cosa ti aspetta</h2>
              <span className="hand" style={{ fontSize: 13 }}>preparato da Chiara</span>
            </div>

            <div className="wf-article">
              <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>matem.</div>
              <div style={{ flex: 1 }}>
                <div className="wf-article__kicker">verifica mercoledì · 3 giorni</div>
                <div className="wf-article__title">Riprendiamo insieme le equazioni prima del compito.</div>
                <div className="wf-article__meta">
                  <span className="wf-pill">ripasso · 30′</span>
                  <span>· si aggancia a ieri sera</span>
                </div>
              </div>
            </div>

            <div className="wf-article">
              <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>letter.</div>
              <div style={{ flex: 1 }}>
                <div className="wf-article__kicker">pronto quando vuoi</div>
                <div className="wf-article__title">Due pagine dei Promessi Sposi, a voce alta.</div>
                <div className="wf-article__meta">
                  <span className="wf-pill">lettura guidata · 15′</span>
                </div>
              </div>
            </div>

            <div className="wf-article">
              <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>test</div>
              <div style={{ flex: 1 }}>
                <div className="wf-article__kicker">simulazione leggera</div>
                <div className="wf-article__title">Dieci domande di logica, giusto per tenere l'occhio.</div>
                <div className="wf-article__meta">
                  <span className="wf-pill">test · 10′</span>
                </div>
              </div>
            </div>
          </div>

          {/* COSTELLAZIONE */}
          <div className="vA-costel">
            <div className="wf-box wf-box--cream" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <h3 style={{ fontSize: 18 }}>Come stai andando</h3>
                <span style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--ink-faint)' }}>aggiornato ieri</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Stai consolidando le equazioni. Dante è un po' indietro, ma puoi recuperare senza fretta.
              </div>
              <div className="wf-constellation">
                <Constellation />
              </div>
            </div>
          </div>

          {/* TUTOR UMANO */}
          <div className="vA-tutor-h">
            <TutorHuman />
          </div>

          {/* TUTOR AI */}
          <div className="vA-tutor-ai">
            <TutorAIEntry />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VARIANT B — Rivista (colonna centrale)
   ───────────────────────────────────────────── */

function VariantB({ mode = 'Compatto', expanded = null }) {
  return (
    <div className="wf" style={{ position: 'relative' }}>
      <div className="wf-inner" style={{ paddingBottom: 100 }}>
        <TopBar mode={mode} />

        <div className="vB-grid">
          {/* SINISTRA — articolo principale (prima era al centro) */}
          <div>
            <Greeting size="md" />

            <ChiaraThread />

            <div style={{ marginTop: 24 }}>
              <div className="wf-tag" style={{ marginBottom: 8 }}>l'apertura</div>
              <div style={{
                paddingBottom: 20,
                borderBottom: '1.5px solid var(--ink)',
                marginBottom: 22
              }}>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  dove eri rimasto — ieri, 22:14
                </div>
                <h1 style={{ fontSize: 72, lineHeight: 1.02, letterSpacing: '-0.02em', marginBottom: 16, textWrap: 'balance', maxWidth: 960 }}>
                  Equazioni di secondo grado, <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)' }}>il momento del delta.</span>
                </h1>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.55,
                  color: 'var(--ink-soft)', maxWidth: 720, marginBottom: 16
                }}>
                  Eri arrivato al terzo esercizio. La formula ti torna, ma quando il coefficiente era negativo ti fermavi. <span style={{ fontStyle: 'italic' }}>Riprendiamo da lì — stavolta più piano.</span>
                </div>
                <button style={{
                  border: '1.5px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper-cream)',
                  fontFamily: 'var(--title)', fontSize: 15, padding: '10px 22px', borderRadius: 999, cursor: 'pointer'
                }}>riprendi la sessione →</button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, marginBottom: 14 }}>Cosa ti aspetta</h2>

                <div style={{ display: 'flex', gap: 18, paddingBottom: 16, borderBottom: '1px dashed var(--ink-faint)', marginBottom: 14 }}>
                  <div className="wf-placeholder" style={{ width: 80, height: 80 }}>mat.</div>
                  <div style={{ flex: 1 }}>
                    <div className="wf-article__kicker">per la verifica di mercoledì</div>
                    <div style={{ fontFamily: 'var(--title)', fontSize: 20, lineHeight: 1.12, marginBottom: 6 }}>
                      Riprendiamo insieme le equazioni prima del compito.
                    </div>
                    <div className="wf-article__meta"><span className="wf-pill">ripasso · 30′</span></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 18, paddingBottom: 16, borderBottom: '1px dashed var(--ink-faint)', marginBottom: 14 }}>
                  <div className="wf-placeholder" style={{ width: 80, height: 80 }}>lett.</div>
                  <div style={{ flex: 1 }}>
                    <div className="wf-article__kicker">pronto quando vuoi</div>
                    <div style={{ fontFamily: 'var(--title)', fontSize: 20, lineHeight: 1.12, marginBottom: 6 }}>
                      Due pagine dei Promessi Sposi, a voce alta.
                    </div>
                    <div className="wf-article__meta"><span className="wf-pill">lettura guidata · 15′</span></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                  <div className="wf-placeholder" style={{ width: 80, height: 80 }}>test</div>
                  <div style={{ flex: 1 }}>
                    <div className="wf-article__kicker">tieni l'occhio</div>
                    <div style={{ fontFamily: 'var(--title)', fontSize: 20, lineHeight: 1.12, marginBottom: 6 }}>
                      Dieci domande di logica.
                    </div>
                    <div className="wf-article__meta"><span className="wf-pill">test · 10′</span></div>
                  </div>
                </div>
              </div>

              {/* ── La cassetta degli attrezzi ─────────────────────────────
                  Sul desktop diventa una striscia editoriale: titolo come
                  rubrica, tre "utensili" appesi in riga con miniatura grande. */}
              <div style={{ marginTop: 32, paddingTop: 22, borderTop: '1.5px solid var(--ink)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 22, margin: 0 }}>La tua cassetta degli attrezzi</h2>
                    <div style={{
                      fontFamily: 'var(--serif)', fontStyle: 'italic',
                      fontSize: 13, color: 'var(--ink-soft)', marginTop: 4
                    }}>
                      strumenti che hai costruito con Chiara — aprili quando vuoi
                    </div>
                  </div>
                  <span className="hand" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    3 strumenti
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { title: 'Parabola viva', kind: 'simulazione · matematica', svg: (
                      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
                        <line x1="12" y1="78" x2="108" y2="78" stroke="var(--ink)" strokeWidth="1"/>
                        <line x1="60" y1="10" x2="60" y2="86" stroke="var(--ink)" strokeWidth="1"/>
                        {/* assi tacche */}
                        {[24, 42, 78, 96].map(x => (
                          <line key={x} x1={x} y1="76" x2={x} y2="80" stroke="var(--ink)" strokeWidth="0.8"/>
                        ))}
                        <path d="M18 18 Q 60 100 102 18" fill="none" stroke="var(--accent, #b6543a)" strokeWidth="1.8"/>
                        <circle cx="60" cy="72" r="2.6" fill="var(--ink)"/>
                        <text x="66" y="70" style={{ fontFamily: 'var(--hand)', fontSize: 8 }} fill="var(--ink-soft)">vertice</text>
                      </svg>
                    )},
                    { title: 'Mappa del Rinascimento', kind: 'mappa concettuale · storia', svg: (
                      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
                        <circle cx="60" cy="45" r="14" fill="none" stroke="var(--ink)" strokeWidth="1.4"/>
                        <text x="60" y="48" textAnchor="middle" style={{ fontFamily: 'var(--title)', fontSize: 9 }} fill="var(--ink)">1492</text>
                        <circle cx="20" cy="22" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                        <circle cx="100" cy="22" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                        <circle cx="20" cy="70" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                        <circle cx="100" cy="70" r="8" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                        <line x1="48" y1="39" x2="26" y2="26" stroke="var(--ink)" strokeWidth="0.8"/>
                        <line x1="72" y1="39" x2="94" y2="26" stroke="var(--ink)" strokeWidth="0.8"/>
                        <line x1="48" y1="51" x2="26" y2="66" stroke="var(--ink)" strokeWidth="0.8"/>
                        <line x1="72" y1="51" x2="94" y2="66" stroke="var(--ink)" strokeWidth="0.8"/>
                      </svg>
                    )},
                    { title: 'Cellula a strati', kind: 'schema interattivo · biologia', svg: (
                      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%' }}>
                        <ellipse cx="60" cy="45" rx="44" ry="30" fill="none" stroke="var(--ink)" strokeWidth="1.4"/>
                        <ellipse cx="60" cy="45" rx="28" ry="20" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                        <circle cx="60" cy="45" r="8" fill="var(--accent-2, #6b8e5a)" opacity="0.3"/>
                        <circle cx="60" cy="45" r="8" fill="none" stroke="var(--ink)" strokeWidth="0.8"/>
                        <circle cx="34" cy="38" r="2.5" fill="var(--ink)"/>
                        <circle cx="82" cy="54" r="2.5" fill="var(--ink)"/>
                        <circle cx="76" cy="30" r="1.8" fill="var(--ink)"/>
                      </svg>
                    )},
                  ].map((a, i) => (
                    <div key={i} style={{
                      border: '1.5px solid var(--ink)', borderRadius: 10,
                      background: 'var(--paper)', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column',
                      boxShadow: '0 3px 0 rgba(26,24,22,0.08)'
                    }}>
                      <div style={{
                        aspectRatio: '4 / 3', background: 'var(--paper-cream)',
                        borderBottom: '1px solid var(--ink-faint)',
                        padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {a.svg}
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <div style={{
                          fontFamily: 'var(--title)', fontSize: 16, lineHeight: 1.18,
                          color: 'var(--ink)'
                        }}>
                          {a.title}
                        </div>
                        <div style={{
                          fontFamily: 'var(--hand)', fontSize: 11.5,
                          color: 'var(--ink-faint)', marginTop: 4
                        }}>
                          {a.kind}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Già alle spalle — tono archivio/redazione ────────────────
                  Lista orizzontale a righe (non card): ritmo giornale,
                  titolo barrato fine, check a penna, commento in corsivo */}
              <div style={{ marginTop: 36, paddingTop: 22, borderTop: '1.5px solid var(--ink)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontSize: 22, margin: 0 }}>Già alle spalle</h2>
                  <span className="hand" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    ultimi due giorni · chiuso bene
                  </span>
                </div>

                {[
                  { when: 'ieri sera · 22:40',     title: 'Capitolo 4 dei Promessi Sposi',     meta: 'lettura · 22′',        note: 'letto ad alta voce, scorrevole' },
                  { when: 'ieri pomeriggio',       title: 'Dieci problemi sul delta',          meta: 'esercizi · 9 / 10',    note: 'ultimo sbagliato — capito il perché' },
                  { when: 'oggi · 14:10',          title: 'Riassunto del Rinascimento',        meta: 'scrittura · 18′',      note: 'consegnato, rientrato nelle 200 parole' },
                ].map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 18, alignItems: 'flex-start',
                    paddingBottom: 14, marginBottom: 14,
                    borderBottom: i < 2 ? '1px dashed var(--ink-faint)' : 'none'
                  }}>
                    {/* check a penna, a sinistra — come un segno sul margine */}
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                         style={{ flexShrink: 0, marginTop: 4 }}>
                      <circle cx="12" cy="12" r="10.5" stroke="var(--accent-2, #6b8e5a)" strokeWidth="1.2" fill="none" opacity="0.55" />
                      <path d="M6.5 12.5 L10.5 16.5 L17.5 8" stroke="var(--accent-2, #6b8e5a)"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 11, color: 'var(--ink-faint)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        marginBottom: 4
                      }}>
                        {t.when}
                      </div>
                      <div style={{
                        fontFamily: 'var(--title)', fontSize: 20, lineHeight: 1.15,
                        color: 'var(--ink)',
                        textDecoration: 'line-through',
                        textDecorationColor: 'var(--ink-faint)',
                        textDecorationThickness: '1px',
                        marginBottom: 6
                      }}>
                        {t.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span className="wf-pill">{t.meta}</span>
                        <span style={{
                          fontFamily: 'var(--serif)', fontStyle: 'italic',
                          fontSize: 14, color: 'var(--ink-soft)'
                        }}>
                          — {t.note}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* chiusura diaristica, a destra */}
                <div style={{
                  fontFamily: 'var(--hand)', fontSize: 14,
                  color: 'var(--accent-2)', textAlign: 'right',
                  paddingRight: 4, marginTop: 4
                }}>
                  tre cose chiuse bene. brava.
                </div>
              </div>
            </div>
          </div>

          {/* Bolla tutor AI fluttuante sotto (in basso a destra) — il
              messaggio di Chiara vive ora inline sotto il saluto, non più
              come spalla destra. */}
        </div>

        {/* BOLLE FLUTTUANTI — coerenti con il mobile */}
        <FloatingChats variant="desktop" expanded={expanded} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VARIANT C — Feed mobile (social ritmo, anima cartacea)
   ───────────────────────────────────────────── */

function VariantC({ expanded = null }) {
  return (
    <div className="wf" style={{ background: '#e8e2d4', padding: 24 }}>
      <div style={{ display: 'flex', gap: 20, height: '100%', alignItems: 'stretch', justifyContent: 'center' }}>
        {/* Telefono */}
        <div className="vC-shell">
          <div className="wf-scroll" style={{ height: '100%', padding: '12px 16px 100px' }}>
            {/* mini topbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px 14px' }}>
              <div style={{ fontFamily: 'var(--title)', fontSize: 17 }}>Iphigen<span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>AI</span></div>
              <div className="wf-mode-switch" style={{ fontSize: 10 }}>
                <span className="on">Compatto</span>
                <span>Disteso</span>
              </div>
            </div>

            <Greeting size="sm" />

            {/* Banner messaggio da Chiara — piccolo invito in alto, simile a
                "notifica redazionale". Non è una card contenuto: è un link verso
                la conversazione con il tutor umano. */}
            <div style={{
              marginTop: 14,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px',
              background: 'var(--paper)',
              border: '1.5px solid var(--ink)',
              borderLeft: '4px solid var(--accent-2)',
              borderRadius: 10,
              cursor: 'pointer'
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-2)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--title)', fontSize: 14
              }}>C</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--hand)', marginBottom: 1 }}>
                  Chiara · ieri, 22:14
                </div>
                <div style={{
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: 13, lineHeight: 1.3, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  "Ho messo due esercizi in più per mercoledì…"
                </div>
              </div>
              <span style={{ color: 'var(--ink)', fontSize: 16, opacity: 0.6, flexShrink: 0 }}>→</span>
            </div>

            {/* Hero card — Dove eri rimasto, full-bleed tipo post */}
            <div style={{
              marginTop: 18,
              border: '1.5px solid var(--ink)', borderRadius: 14,
              background: 'var(--paper)', overflow: 'hidden'
            }}>
              <div className="wf-placeholder" style={{ height: 140, borderRadius: 0, borderWidth: '0 0 1.5px 0' }}>
                snapshot del foglio<br />di lavoro di ieri
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div className="wf-tag" style={{ fontSize: 12 }}>dove eri rimasto — ieri 22:14</div>
                <div style={{ fontFamily: 'var(--title)', fontSize: 22, lineHeight: 1.1, margin: '6px 0 8px' }}>
                  Equazioni di secondo grado, il delta.
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4, marginBottom: 12 }}>
                  Riprendiamo dal terzo esercizio — stavolta più piano.
                </div>
                <button style={{
                  width: '100%', border: '1.5px solid var(--ink)', background: 'var(--ink)',
                  color: 'var(--paper-cream)', fontFamily: 'var(--title)', fontSize: 14,
                  padding: '10px', borderRadius: 999
                }}>riprendi →</button>
              </div>
            </div>

            {/* Feed attività — la firma "da Chiara" appare solo quando è davvero
                intervenuta oggi (qui: una sola card è sua, le altre sono automatiche) */}
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 17 }}>Cosa ti aspetta</h3>
            </div>

            {/* Card feed: quella che Chiara ha preparato — firma visibile */}
            <div style={{ marginTop: 10, border: '1.5px solid var(--ink)', borderRadius: 12, padding: '12px 14px', background: 'var(--paper)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="wf-article__kicker" style={{ margin: 0 }}>verifica mercoledì</span>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>·</span>
                <span style={{ fontFamily: 'var(--hand)', fontSize: 11, color: 'var(--accent-2)' }}>preparato da Chiara</span>
              </div>
              <div style={{ fontFamily: 'var(--title)', fontSize: 17, lineHeight: 1.15, margin: '2px 0 6px' }}>
                Riprendiamo le equazioni prima del compito.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="wf-pill" style={{ fontSize: 10 }}>ripasso · 30′</span>
              </div>
            </div>

            {/* Card feed automatica — nessuna firma */}
            <div style={{ marginTop: 10, border: '1.5px solid var(--ink)', borderRadius: 12, padding: '12px 14px', background: 'var(--paper)' }}>
              <div className="wf-article__kicker">lettura guidata</div>
              <div style={{ fontFamily: 'var(--title)', fontSize: 17, lineHeight: 1.15, margin: '4px 0 6px' }}>
                Due pagine dei Promessi Sposi.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="wf-pill" style={{ fontSize: 10 }}>15′</span>
              </div>
            </div>

            {/* ── La cassetta degli attrezzi ────────────────────────────
                Artifact interattivi (sim, mappe, schemi) creati da Luca,
                dal genitore o da Chiara. Miniatura + titolo, niente CTA crea. */}
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 17 }}>La tua cassetta degli attrezzi</h3>
              <span className="hand" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>3 strumenti</span>
            </div>

            <div style={{
              marginTop: 10,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8
            }}>
              {[
                { title: 'Parabola viva', kind: 'sim', svg: (
                  <svg viewBox="0 0 60 50" style={{ width: '100%', height: '100%' }}>
                    <line x1="6" y1="42" x2="54" y2="42" stroke="var(--ink)" strokeWidth="1"/>
                    <line x1="30" y1="6" x2="30" y2="48" stroke="var(--ink)" strokeWidth="1"/>
                    <path d="M10 10 Q 30 55 50 10" fill="none" stroke="var(--accent, #b6543a)" strokeWidth="1.6"/>
                    <circle cx="30" cy="40" r="2.2" fill="var(--ink)"/>
                  </svg>
                )},
                { title: 'Mappa del Rinascimento', kind: 'mappa', svg: (
                  <svg viewBox="0 0 60 50" style={{ width: '100%', height: '100%' }}>
                    <circle cx="30" cy="25" r="7" fill="none" stroke="var(--ink)" strokeWidth="1.2"/>
                    <circle cx="10" cy="12" r="4" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                    <circle cx="50" cy="12" r="4" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                    <circle cx="10" cy="40" r="4" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                    <circle cx="50" cy="40" r="4" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                    <line x1="24" y1="22" x2="14" y2="14" stroke="var(--ink)" strokeWidth="0.8"/>
                    <line x1="36" y1="22" x2="46" y2="14" stroke="var(--ink)" strokeWidth="0.8"/>
                    <line x1="24" y1="28" x2="14" y2="38" stroke="var(--ink)" strokeWidth="0.8"/>
                    <line x1="36" y1="28" x2="46" y2="38" stroke="var(--ink)" strokeWidth="0.8"/>
                  </svg>
                )},
                { title: 'Cellula a strati', kind: 'schema', svg: (
                  <svg viewBox="0 0 60 50" style={{ width: '100%', height: '100%' }}>
                    <ellipse cx="30" cy="25" rx="22" ry="16" fill="none" stroke="var(--ink)" strokeWidth="1.2"/>
                    <ellipse cx="30" cy="25" rx="14" ry="10" fill="none" stroke="var(--ink)" strokeWidth="1"/>
                    <circle cx="30" cy="25" r="4" fill="var(--accent-2, #6b8e5a)" opacity="0.35"/>
                    <circle cx="18" cy="22" r="1.5" fill="var(--ink)"/>
                    <circle cx="42" cy="30" r="1.5" fill="var(--ink)"/>
                  </svg>
                )},
              ].map((a, i) => (
                <div key={i} style={{
                  border: '1.5px solid var(--ink)', borderRadius: 8,
                  background: 'var(--paper)', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{
                    aspectRatio: '1 / 1', background: 'var(--paper-cream)',
                    borderBottom: '1px solid var(--ink-faint)',
                    padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {a.svg}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{
                      fontFamily: 'var(--title)', fontSize: 11.5, lineHeight: 1.15,
                      color: 'var(--ink)'
                    }}>
                      {a.title}
                    </div>
                    <div style={{
                      fontFamily: 'var(--hand)', fontSize: 9.5,
                      color: 'var(--ink-faint)', marginTop: 2
                    }}>
                      {a.kind}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Già alle spalle — compiti chiusi oggi/ieri, in tono di soddisfazione
                (non una lista burocratica, ma una piccola riga di trofei quotidiani) */}
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 17 }}>Già alle spalle</h3>
              <span className="hand" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>ultimi due giorni</span>
            </div>

            {[
              { kicker: 'ieri sera', title: 'Capitolo 4 dei Promessi Sposi', meta: 'lettura · 22′', note: 'letto ad alta voce, scorrevole' },
              { kicker: 'ieri', title: 'Dieci problemi sul delta', meta: 'esercizi · 9 / 10', note: 'ultimo sbagliato, capito il perché' },
              { kicker: 'oggi pomeriggio', title: 'Riassunto del Rinascimento', meta: 'scrittura · 18′', note: 'consegnato' },
            ].map((t, i) => (
              <div key={i} style={{
                marginTop: 10, borderLeft: '3px solid var(--ink)',
                paddingLeft: 12, paddingRight: 8, paddingTop: 8, paddingBottom: 8,
                background: 'var(--paper)', borderRadius: '0 8px 8px 0',
                border: '1.5px solid var(--ink)', borderLeftWidth: 3,
                position: 'relative'
              }}>
                {/* check disegnato a mano, non l'icona di sistema */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     style={{ position: 'absolute', top: 10, right: 10 }}>
                  <path d="M4 13 L10 19 L21 5" stroke="var(--accent-2, #6b8e5a)"
                        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
                </svg>
                <div style={{ fontFamily: 'var(--hand)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>
                  {t.kicker}
                </div>
                <div style={{
                  fontFamily: 'var(--title)', fontSize: 15, lineHeight: 1.2,
                  color: 'var(--ink)', paddingRight: 22,
                  textDecoration: 'line-through',
                  textDecorationColor: 'var(--ink-faint)',
                  textDecorationThickness: '1px'
                }}>
                  {t.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span className="wf-pill" style={{ fontSize: 10 }}>{t.meta}</span>
                  <span style={{
                    fontFamily: 'var(--serif)', fontStyle: 'italic',
                    fontSize: 11.5, color: 'var(--ink-soft)'
                  }}>
                    — {t.note}
                  </span>
                </div>
              </div>
            ))}

            {/* micro-riassunto narrativo, tono diaristico */}
            <div style={{
              marginTop: 8, padding: '8px 2px',
              fontFamily: 'var(--hand)', fontSize: 12.5,
              color: 'var(--accent-2)', textAlign: 'right'
            }}>
              tre cose chiuse bene. brava.
            </div>

            {/* Costellazione — card speciale */}
            <div style={{ marginTop: 18, border: '1.5px solid var(--ink)', borderRadius: 12, padding: '14px 14px 8px', background: 'var(--paper-cream)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 16 }}>Come stai andando</h3>
                <span className="hand" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>questa settimana</span>
              </div>
              <div style={{ height: 170, marginTop: 4 }}>
                <Constellation compact />
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-soft)', padding: '4px 2px 4px' }}>
                Stai consolidando le equazioni.
              </div>
            </div>

            {/* TutorHuman in fondo rimosso: il banner in alto è ora il canale
                principale verso Chiara. Evita duplicazione. */}

            {/* Spazio per le bolle che galleggiano in basso */}
            <div style={{ height: 70 }} />
          </div>

          {/* Due bolle fluttuanti — stesso component del desktop */}
          <FloatingChats variant="mobile" expanded={expanded} />
        </div>

        {/* Annotazioni accanto al telefono */}
        <div style={{ flex: 1, maxWidth: 280, paddingTop: 60, position: 'relative' }}>
          <div className="wf-annot" style={{ position: 'relative', transform: 'rotate(-1.5deg)', maxWidth: 'unset' }}>
            ritmo del feed<br />
            (scroll social)<br />
            ma <span className="ital serif" style={{ color: 'var(--ink-soft)' }}>typeset</span> da rivista
          </div>
          <div className="wf-annot" style={{ position: 'relative', marginTop: 40, transform: 'rotate(1deg)', maxWidth: 'unset', color: 'var(--accent-2)' }}>
            due bolle fluttuanti<br />
            in basso → Chiara e<br />
            il tutor AI sempre<br />
            a portata di pollice
          </div>
          <div className="wf-annot" style={{ position: 'relative', marginTop: 40, transform: 'rotate(-0.5deg)', maxWidth: 'unset', color: 'var(--ink-soft)' }}>
            ogni card è un "post":<br />
            kicker handwritten,<br />
            titolo serif, meta piccola
          </div>
          <div className="wf-annot" style={{ position: 'relative', marginTop: 40, transform: 'rotate(1deg)', maxWidth: 'unset' }}>
            PWA first — pensato<br />
            per il browser mobile
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VARIANT D — Tavolo del tutor
   (asimmetria ribaltata, tutor umano laterale prominente)
   ───────────────────────────────────────────── */

function VariantD() {
  return (
    <div className="wf">
      <div className="wf-inner">
        <TopBar mode="Disteso" />

        <div className="vD-grid">
          {/* SINISTRA — il "tavolo del tutor" (intimo) */}
          <div style={{ background: 'var(--paper-warm)', borderRadius: 14, padding: '22px 22px 20px', border: '1.5px solid var(--ink)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-soft)', marginBottom: 14 }}>
              il tuo tavolo con Chiara
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--accent-2)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--title)', fontSize: 22
              }}>C</div>
              <div>
                <div style={{ fontFamily: 'var(--title)', fontSize: 20 }}>Chiara</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>il tuo tutor · online ora</div>
              </div>
            </div>

            <div className="wf-tutor-msg" style={{ marginTop: 22, background: 'var(--paper-cream)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', lineHeight: 1.5 }}>
                "Ieri sera sei andato bene sulle equazioni. Ho preparato un ripasso leggero per domani e due esercizi mirati. Fammi sapere se il delta ti torna meglio stavolta."
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 8 }}>ieri, 22:14</div>
            </div>

            <div style={{ marginTop: 14, padding: '10px 14px', border: '1.2px dashed var(--ink-faint)', borderRadius: 8, background: 'var(--paper-cream)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-faint)' }}>
                scrivi a Chiara…
              </div>
            </div>

            {/* progresso mini */}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed var(--ink-faint)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)', marginBottom: 8 }}>
                come stai andando
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 10 }}>
                Stai consolidando le equazioni. Dante un po' fermo, ma si recupera.
              </div>
              <div style={{ height: 150 }}>
                <Constellation compact />
              </div>
            </div>
          </div>

          {/* DESTRA — lavoro dello studente */}
          <div>
            <Greeting size="md" style={{ marginBottom: 22 }} />

            {/* Dove eri rimasto */}
            <div className="wf-box" style={{ padding: '20px 22px', marginBottom: 22 }}>
              <div className="wf-tag" style={{ marginBottom: 6 }}>dove eri rimasto</div>
              <div style={{ fontFamily: 'var(--title)', fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.015em', marginBottom: 10 }}>
                Equazioni di secondo grado, il delta.
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 14, maxWidth: 520 }}>
                Terzo esercizio di cinque. Stavolta più piano sui coefficienti negativi.
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button style={{
                  border: '1.5px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper-cream)',
                  fontFamily: 'var(--title)', fontSize: 14, padding: '10px 18px', borderRadius: 999
                }}>riprendi →</button>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>3 di 5 · 24′ · ieri 22:14</span>
              </div>
            </div>

            {/* Cosa ti aspetta */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 22 }}>Cosa ti aspetta</h2>
                <span className="hand" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>tre cose, niente di più</span>
              </div>

              <div className="wf-article wf-rot-l">
                <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>mat.</div>
                <div style={{ flex: 1 }}>
                  <div className="wf-article__kicker">verifica mercoledì</div>
                  <div className="wf-article__title">Riprendiamo insieme le equazioni.</div>
                  <div className="wf-article__meta"><span className="wf-pill">ripasso · 30′</span></div>
                </div>
              </div>

              <div className="wf-article wf-rot-r">
                <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>lett.</div>
                <div style={{ flex: 1 }}>
                  <div className="wf-article__kicker">pronto quando vuoi</div>
                  <div className="wf-article__title">Due pagine dei Promessi Sposi, a voce alta.</div>
                  <div className="wf-article__meta"><span className="wf-pill">15′</span></div>
                </div>
              </div>

              <div className="wf-article">
                <div className="wf-article__thumb wf-placeholder" style={{ fontSize: 9 }}>test</div>
                <div style={{ flex: 1 }}>
                  <div className="wf-article__kicker">simulazione leggera</div>
                  <div className="wf-article__title">Dieci domande di logica.</div>
                  <div className="wf-article__meta"><span className="wf-pill">10′</span></div>
                </div>
              </div>
            </div>

            {/* Tutor AI */}
            <div style={{ marginTop: 22 }}>
              <TutorAIEntry />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Export to window */
Object.assign(window, { VariantA, VariantB, VariantC, VariantD });
