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
type ProductCardData = { title: string; price: string; imageUrl: string; linkUrl: string; };
type ProductCardMsg = { id: string; type: 'product_card'; role: 'assistant'; data: ProductCardData };

type MapCardData = { title: string; embedUrl: string; linkUrl: string };
type MapCardMsg = { id: string; type: 'map_card'; role: 'assistant'; data: MapCardData };
type Msg = TextMsg | ButtonMsg | ProductCardMsg | MapCardMsg;


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
  const streamEndedRef = useRef(false);

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
  /* History al mount - VERSIONE CORRETTA              */
  /* -------------------------------------------------- */
  useEffect(() => {
    getHistory(sessionId)
      .then(h =>
        setMessages(
          h.filter(m => m.content && !m.content.startsWith('[streaming'))
            .flatMap<Msg>(m => {
              try {
                const items = JSON.parse(m.content);
                const msgs = Array.isArray(items) ? items : [items];
                return msgs.map(obj => {
                  if (obj?.type === 'product_card') return { id: crypto.randomUUID(), role: 'assistant', type: 'product_card', data: obj.data };
                  if (obj?.type === 'map_card') return { id: crypto.randomUUID(), role: 'assistant', type: 'map_card', data: obj.data };
                  if (obj?.type === 'button') return { id: crypto.randomUUID(), role: 'assistant', type: 'button', label: obj.label, action: obj.action, class: obj.class };
                  if (obj?.type === 'text') return { id: crypto.randomUUID(), role: 'assistant', type: 'text', content: String(obj.content ?? '') };
                  return null;
                }).filter(Boolean) as Msg[];
              } catch { /* non-JSON */ }
              return [{ id: crypto.randomUUID(), role: m.role, type: 'text', content: m.content }];
            })
        )
      ).catch(() => { });
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
    streamEndedRef.current = false;

    const payload: SendOpts = {
      client_slug: slug,
      message: text,
      session_id: sessionId,
      pageContent: pageRef.current ?? undefined,
      stream: true
    };
    pageRef.current = null;

    console.log('➡️ [FRONTEND] Sending payload:', payload);

    const es = sendMessageStream(payload);

    /* ---------- data ---------- */
    es.onmessage(chunk => {
      console.log('⬇️ [FRONTEND] Received chunk:', chunk);
      if (chunk === '[END]' && !streamEndedRef.current) {
      streamEndedRef.current = true; // Imposta il flag per non rientrare
      console.log('🔚 [FRONTEND] Stream ended.'); // 🪵 [FRONTEND-LOG]
      es.close();
      setLoading(false);
      return;
    }

    if (chunk === '[END]') return;

      const incoming: Msg[] = [];
      try {
        const parsed = JSON.parse(chunk);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        console.log('📦 [FRONTEND] Parsed JSON items:', items);

        items.forEach((obj: any) => {
          if (obj.type === 'product_card' && obj.data) incoming.push({ id: crypto.randomUUID(), role: 'assistant', type: 'product_card', data: obj.data });
          else if (obj.type === 'button') incoming.push({ id: crypto.randomUUID(), role: 'assistant', type: 'button', label: obj.label, action: obj.action, class: obj.class });
          else if (obj.type === 'text') incoming.push({ id: crypto.randomUUID(), role: 'assistant', type: 'text', content: obj.content });
          else if (obj.type === 'map_card' && obj.data) incoming.push({ id: crypto.randomUUID(), role: 'assistant', type: 'map_card', data: obj.data });
        });

      } catch {
        console.log('✍️ [FRONTEND] Received raw text chunk:', chunk);
        incoming.push({ id: crypto.randomUUID(), role: 'assistant', type: 'text', content: chunk });
      }

      if (incoming.length > 0) {
        console.log('✨ [FRONTEND] Updating state with incoming messages:', incoming);
        setMessages(prev => {
          console.log('🔄 [FRONTEND] State BEFORE update:', prev);
          const out = [...prev];
          let last = out[out.length - 1];

          incoming.forEach(msg => {
            if (msg.type === 'text' && last?.type === 'text' && last.role === 'assistant') {
              last.content += msg.content;
            } else {
              out.push(msg);
              last = msg;
            }
          });
           console.log('✅ [FRONTEND] State AFTER update:', out);
          return out;
        });
      }
    });

    /* ---------- error ---------- */
    es.onerror(() => {
       console.error('❌ [FRONTEND] SSE Error!');
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
              if (m.type === 'product_card') {
                return (
                  <div key={m.id} className="message assistant">
                    <a href={m.data.linkUrl} target="_blank" rel="noopener noreferrer" className="product-card">
                      <img src={m.data.imageUrl} alt={m.data.title} className="product-card-image" />
                      <div className="product-card-info">
                        <div className="product-card-title">{m.data.title}</div>
                        <div className="product-card-price">{m.data.price}</div>
                      </div>
                    </a>
                  </div>
                );
              }
              if (m.type === 'map_card') {
                return (
                  <div key={m.id} className="message assistant">
                    <div className="map-card">
                      <iframe
                        src={m.data.embedUrl}
                        width="100%" height="180"
                        loading="lazy" style={{ border: 0 }}
                        allowFullScreen></iframe>
                      <div className="map-card-footer">
                        <a href={m.data.linkUrl} target="_blank" rel="noopener noreferrer">
                          Apri su Google Maps
                        </a>
                      </div>
                    </div>
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