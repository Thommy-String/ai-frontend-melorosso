import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  sendMessageStream,
  getHistory,
  type SendOpts
} from './api/api';
import { extractPageContent } from '../utils/pageContent';
import './chatWidget.css';

/* ---------- props white-label -------------------------------------- */
export interface ChatWidgetProps {
  slug: string;           // es. "barilla"
  title?: string;
  badgeMsgs?: string[];
  accent?: string;           // colore principale
  logoUrl?: string;           // icona header
  startText?: string;           // placeholder input
  floating?: boolean;          // se true bolla fissa
}

/* ---------- messaggio tipizzato ------------------------------------ */
type TextMsg = { id: string; type: 'text'; role: 'user' | 'assistant'; content: string };
type ButtonMsg = { id: string; type: 'button'; role: 'assistant'; label: string; action: string; class?: string };
type Msg = TextMsg | ButtonMsg;


/* ---------- helper -------------------------------------------------- */
type Timer = ReturnType<typeof setTimeout>;   // evita NodeJS.Timeout

/* =================================================================== */
export default function ChatWidget({
  slug,
  title,
  badgeMsgs = [],
  accent = '#3b82f6',
  logoUrl = '/bot.png',
  startText = 'Scrivi…',
  floating = false
}: ChatWidgetProps) {

  /* -------------------------------------------------- */
  /*  Badge rotante con animazione sincronizzata        */
  /* -------------------------------------------------- */
  const SHOW_MS = 4000;         // badge visibile
  const PAUSE_MS = 4000;         // pausa fra i testi

  // ⬇️  Stati da usare nell'useEffect
  const [badgeIdx, setBadgeIdx] = useState<number>(0);   // indice messaggio
  const [visible, setVisible] = useState<boolean>(false); // true = .show

  useEffect(() => {
    if (!badgeMsgs.length) return;

    let timer: Timer;

    const cycle = (index: number) => {
      /* 1️⃣ rende il badge con opacity 0 */
      setBadgeIdx(index);
      setVisible(false);

      /* 2️⃣ frame successivo → trigger della transizione di fade-in */
      requestAnimationFrame(() => setVisible(true));

      /* 3️⃣ dopo SHOW_MS si avvia il fade-out                      */
      timer = setTimeout(() => {
        setVisible(false);

        /* 4️⃣ dopo la pausa si passa al prossimo messaggio          */
        timer = setTimeout(() => {
          cycle((index + 1) % badgeMsgs.length);
        }, PAUSE_MS);

      }, SHOW_MS);
    };

    cycle(0);                     // avvio ciclo
    return () => clearTimeout(timer);
  }, [badgeMsgs]);


  /* -------------------------------------------------- */
  /*  Stato sessione / UI                               */
  /* -------------------------------------------------- */
  const [sessionId] = useState(() => {
    const k = `session_id_${slug}`;
    let id = localStorage.getItem(k);
    if (!id) { id = uuidv4(); localStorage.setItem(k, id); }
    return id;
  });


  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!floating);

  /* -------------------------------------------------- */
  /*  Page-content (RAG)                                */
  /* -------------------------------------------------- */
  const pageRef = useRef<string | null>(extractPageContent());
  useEffect(() => {
    const refresh = () => { pageRef.current = extractPageContent(); };
    window.addEventListener('popstate', refresh);
    window.addEventListener('hashchange', refresh);
    return () => {
      window.removeEventListener('popstate', refresh);
      window.removeEventListener('hashchange', refresh);
    };
  }, []);

  /* -------------------------------------------------- */
  /*  History al mount                                  */
  /* -------------------------------------------------- */
  useEffect(() => {
    getHistory(sessionId)
      .then(h =>
        setMessages(
          h
            .filter(m => m.content !== '[streaming…]')
            .map<Msg>(m => {
              try {                       // prova parse JSON
                const obj = JSON.parse(m.content);
                if (obj?.type === 'button') {
                  return {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    type: 'button',
                    label: obj.label ?? 'Apri',
                    action: obj.action ?? '#',
                    class: obj.class ?? ''
                  };
                }
                if (obj?.type === 'text') {
                  return {
                    id: crypto.randomUUID(),
                    role: m.role,
                    type: 'text',
                    content: String(obj.content ?? '')
                  };
                }
              } catch { /* non-JSON */ }

              return {                    // fallback puro testo
                id: crypto.randomUUID(),
                role: m.role,
                type: 'text',
                content: m.content
              };
            })
        )
      )
      .catch(() => { });
  }, [sessionId, slug]);

  /* -------------------------------------------------- */
  /*  Autoscroll                                        */
  /* -------------------------------------------------- */
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); },
    [messages, loading, open]);

  /* -------------------------------------------------- */
  /*  Invio messaggio                                   */
  /* -------------------------------------------------- */
  const doSend = () => {
    const text = input.trim();
    if (!text) return;

    /* 1️⃣ echo locale del messaggio utente */
    setMessages(m => [
      ...m,
      { id: crypto.randomUUID(), role: 'user', type: 'text', content: text }
    ]);
    setInput('');
    setLoading(true);

    const payload: SendOpts = {
      client_slug: slug,
      message: text,
      session_id: sessionId,
      pageContent: pageRef.current ?? undefined,
      stream: true
    };
    pageRef.current = null;

    const es = sendMessageStream(payload);

    /* ---------- data ---------- */
    es.onmessage(chunk => {
      if (chunk === '[END]') {        // fine stream
        es.close();
        setLoading(false);
        return;
      }

      /* 2️⃣ normalizziamo il chunk               */
      const incoming: Msg[] = [];

      try {
        const parsed = JSON.parse(chunk);

        /* – singolo oggetto ------------------------------------------------ */
        if (!Array.isArray(parsed)) {
          if (parsed.type === 'button') {
            incoming.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              type: 'button',
              label: parsed.label ?? 'Apri',
              action: parsed.action ?? '#',
              class: parsed.class ?? ''
            });
          } else if (parsed.type === 'text') {
            incoming.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              type: 'text',
              content: parsed.content ?? ''
            });
          }
        }

        /* – array di oggetti ------------------------------------------------ */
        if (Array.isArray(parsed)) {
          parsed.forEach((obj: any) => {
            if (obj.type === 'button') {
              incoming.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                type: 'button',
                label: obj.label ?? 'Apri',
                action: obj.action ?? '#',
                class: obj.class ?? ''
              });
            } else if (obj.type === 'text') {
              incoming.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                type: 'text',
                content: obj.content ?? ''
              });
            }
          });
        }
      } catch {
        /* non-JSON → verrà gestito sotto */
      }

      /* – fallback testo semplice ------------------------------------------ */
      if (incoming.length === 0) {
        incoming.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: chunk.replace(/\n+/g, '')
        });
      }

      /* 3️⃣ merge / append nello stato messaggi ---------------------------- */
      setMessages(prev => {
        const out = [...prev];
        const last = out[out.length - 1];

        incoming.forEach(msg => {
          if (
            msg.type === 'text' &&
            last?.role === 'assistant' &&
            last.type === 'text'
          ) {
            out[out.length - 1] = {
              ...last,
              content: last.content + msg.content
            };
          } else {
            out.push(msg);
          }
        });

        return out;
      });
    });

    /* ---------- error ---------- */
    es.onerror(() => {
      es.close();
      setLoading(false);
      setMessages(m => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: '⚠️ Errore di rete.'
        }
      ]);
    });
  };

  /* -------------------------------------------------- */
  /*  UI                                                */
  /* -------------------------------------------------- */
  return (
    <>
      {/* ---------- bolla --------------------------------- */}
      {floating && !open && (
        <button className="mlr-bubble" onClick={() => setOpen(true)}>
          <img src={logoUrl} alt="chat" />
          {badgeMsgs.length > 0 && (
            <span
              key={badgeIdx}
              className={`mlr-badge ${visible ? 'show' : ''}`}
            >
              {badgeMsgs[badgeIdx]}
            </span>
          )}
        </button>
      )}

      {/* ---------- widget aperto -------------------------- */}
      {(!floating || open) && (
        <div className={`chat-widget ${floating ? 'mlr-floating' : ''}`}>
          {/* HEADER */}
          <header className="chat-header"
            onClick={() => floating && setOpen(false)}>
            <img src={logoUrl} alt="logo" />
            <div className="mlr-head">
              <h3>{title || slug}</h3>
              <span className="mlr-online"><i />Online</span>
            </div>
            {floating && <span className="mlr-close">×</span>}
          </header>

          {/* MESSAGGI */}
          <div className="chat-messages">
            {messages.map(m => {
              // Messaggio di testo normale
              if (m.type === 'text') {
                return (
                  <div key={m.id} className={`message ${m.role}`}>
                    {m.content}
                  </div>
                );
              }
              // Messaggio di tipo bottone
              if (m.type === 'button') {
                return (
                  <div key={m.id} className={`message ${m.role}`}>
                    <a href={m.action} className={`chat-button ${m.class || ''}`}>
                      {m.label}
                    </a>
                  </div>
                );
              }
              return null;
            })}
            {loading && <div className="message assistant">…</div>}
            <div ref={endRef} />
          </div>

          {/* INPUT */}
          <div className="chat-input">
            <input value={input}
              placeholder={startText}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && doSend()} />
            <button onClick={doSend}
              disabled={loading || !input.trim()}>Invia</button>
          </div>
        </div>
      )}
    </>
  );
}