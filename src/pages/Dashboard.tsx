// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './Dashboard.css';

const API = 'https://ai-backend-melorosso.onrender.com';

interface Session {
  session_id: string;
  created_at: string;
  updated_at: string;
  message_count: string;
  preview: string | null;
  avatarUrl?: string; // Aggiungiamo un campo per l'URL dell'avatar
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}


interface Faq { question: string; count: number }

/* ------- tipi & stato ------------------------------------------- */
interface Insight {
  title: string;     // es. "Dubbi ricorrenti sui prezzi"
  body: string;     // testo descrittivo
}


// URL base per le immagini placeholder di Lorem Picsum
// Possiamo generare immagini uniche usando un ID alla fine: https://picsum.photos/id/ID/SIZE
const LOREM_PICSUM_BASE_URL = 'https://picsum.photos/id/';
const AVATAR_SIZE = 200; // Dimensione in pixel per l'avatar (quadrato)
const MAX_PICSUM_ID = 1000; // Il numero massimo di ID disponibili su Picsum Photos


export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [monthTokens, setMonthTokens] = useState(0);
  const [prevMonthTokens, setPrevMonthTokens] = useState(0);
  const [active, setAct] = useState(0);
  const [msgs, setMsgs] = useState(0);
  const [avgRes, setAvg] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);

  const [faqs, setFaqs] = useState<{ q: string; count: number }[]>([]);
  const [tips, setTips] = useState('');
  const [sessionsList, setSessionsList] = useState<Session[]>([]
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);


  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) { nav('/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/stats/${slug}`, { headers }),
      fetch(`${API}/stats/sessions/${slug}`, { headers }),
      fetch(`${API}/stats/faq/${slug}?days=30`, { headers }),
      fetch(`${API}/stats/insights/${slug}?days=30`, { headers })
    ])
      .then(async ([statsRes, sessionsRes, faqRes, insRes]) => {
        if ([statsRes, sessionsRes, faqRes, insRes].some(r => r.status === 401 || r.status === 403)) {
          nav('/login'); return;
        }

        /* --- deserialize ------------------------------------------------ */
        const statsData = await statsRes.json();
        const sessionsData = await sessionsRes.json() as Session[];
        const faqData = await faqRes.json();
        const insightsData = await insRes.json();

        /* --- metriche --------------------------------------------------- */
        setMonthTokens(Number(statsData.monthTokens || 0));
        setPrevMonthTokens(Number(statsData.prevMonthTokens || 0));
        setAct(statsData.active);
        setMsgs(statsData.totalMessages);
        setAvg(statsData.avg_response || statsData.avgResponse || 0);
        setSessionsCount(statsData.total_sessions || statsData.total_Sessions || 0);


        /* --- FAQ -------------------------------------------------------- */
        setFaqs(faqData.faqs ?? []);
        setTips(faqData.tips ?? '');

        console.log('[raw] insightsData ⇒', insightsData);
        /*Insights */
        const parsedInsights: Insight[] = [
          ...(insightsData.bullets ?? []).map((b: string) => ({
            title: 'Insight', body: b
          })),
          ...(insightsData.actions ?? []).map((a: string) => ({
            title: 'Azione consigliata', body: a
          }))
        ];
        console.log('[parsed] insights ⇒', parsedInsights);
        setInsights(parsedInsights);

        /* --- avatar placeholder ---------------------------------------- */
        const sessionsWithAvatars = sessionsData.map((s, idx) => {
          const id = (idx % (MAX_PICSUM_ID - 50)) + 50;
          return { ...s, avatarUrl: `${LOREM_PICSUM_BASE_URL}${id}/${AVATAR_SIZE}` };
        });
        setSessionsList(sessionsWithAvatars);
      })
      .catch(console.error);
  }, [slug, nav]);

  const handleOpenChat = (sessionId: string) => {
    const token = localStorage.getItem('jwt');
    if (!token) return;

    setSelectedSessionId(sessionId);
    setIsLoadingChat(true);
    setChatMessages([]);

    fetch(`${API}/chat/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setChatMessages(data.chatLogs || []))
      .catch(console.error)
      .finally(() => setIsLoadingChat(false));
  };

  const handleCloseChat = () => {
    setSelectedSessionId(null);
    setChatMessages([]);
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard {(slug)?.toUpperCase()}</h1>
      <div className="dashboard-cards">
        <MetricCard
          img="https://static.thenounproject.com/png/926001-200.png"
          title="Sessioni attive"
          subtitle="Ultima ora"
          value={active}
          description="Numero di persone che hanno avviato una conversazione nell'ultima ora"
        />
        <MetricCard
          img="https://cdn-icons-png.flaticon.com/512/865/865771.png"
          title="Messaggi totali"
          subtitle="Dall’inizio"
          value={msgs}
          description="Totale messaggi ricevuti dal chatbot su questo account."
        />
        <MetricCard
          img="https://static.thenounproject.com/png/1139400-200.png"
          title="Velocità risposta media"
          subtitle="In secondi"
          value={avgRes}
          description="Tempo medio di risposta del bot, calcolato su tutte le sessioni."
        />
        <MetricCard
          img="https://static.thenounproject.com/png/1433088-200.png"
          title="Conversazioni totali"
          subtitle="Dall’inizio"
          value={sessionsCount}
          description="Totale delle conversazioni avviate con il chatbot."
        />


        <MetricCard
          img="https://static.thenounproject.com/png/6203007-200.png"
          title="Token mese corrente"
          subtitle={new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
          value={monthTokens}
          description={`Mese scorso: ${prevMonthTokens.toLocaleString()} token`}
        />

        {/* ---- CARD FAQ ---- */}
        {faqs.length > 0 && (
          <FaqCard faqs={faqs.slice(0, 5)} tips={tips} />
        )}

        {/* INSIGHTS */}
        {insights.length > 0 && <InsightsCard insights={insights} />}
        


      </div>

      <div className={`chat-section-container ${selectedSessionId ? 'chat-open' : ''}`}>
        <div className="chat-list-pane">
          <div className="chat-list-header">
            <h2>Conversazioni</h2>
          </div>
          <div className="chat-list-items">
            {sessionsList.length > 0 ? (
              sessionsList.map((s) => (
                <div
                  key={s.session_id}
                  className={`chat-list-item ${selectedSessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => handleOpenChat(s.session_id)}
                >
                  {/* Usa l'URL dell'avatar come background-image */}
                  <div
                    className="chat-list-item-avatar"
                    style={{ backgroundImage: `url(${s.avatarUrl})` }}
                  ></div>
                  <div className="chat-list-item-content">
                    <div className="chat-list-item-header">
                      <span className="chat-list-item-id">...{s.session_id.slice(-8)}</span>
                      <span className="chat-list-item-time">
                        {new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <small className="chat-list-item-date">
                          {new Date(s.updated_at).toLocaleDateString([], {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </small>
                      </span>
                    </div>
                    <div className="chat-list-item-preview">
                      {s.preview ? s.preview : 'Nessuna anteprima'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-sessions-message">Nessuna sessione trovata.</p>
            )}
          </div>
        </div>

        <div className="chat-detail-pane">
          {selectedSessionId ? (
            <>
              <div className="chat-detail-header">
                <button className="back-button" onClick={handleCloseChat}>
                  &larr;
                </button>
                <h3>Dettaglio Chat: ...{selectedSessionId.slice(-8)}</h3>
              </div>
              <div className="messages-container">
                {isLoadingChat ? (
                  <p className="loading-message">Caricamento messaggi...</p>
                ) : chatMessages.length > 0 ? (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`message-bubble ${msg.role}`}>
                      <p>{msg.content}</p>
                      <span className="message-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="no-messages-message">Nessun messaggio in questa chat.</p>
                )}
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Seleziona una chat per visualizzare i messaggi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  img,
  title,
  subtitle,
  description,
  value,
}: {
  img: string;
  title: string;
  subtitle: string;
  description: string;
  value: number;
}) {
  return (
    <div className="metric-card">
      <img src={img} alt={title} className="metric-card-img" />
      <div className="metric-card-content">
        <div className="metric-card-title">{title}</div>
        <div className="metric-card-subtitle">{subtitle}</div>
        <div className="metric-card-value">{value}</div>
        <div className="metric-card-description">{description}</div>
      </div>
    </div>
  );
}


function FaqCard({ faqs, tips }: { faqs: Faq[]; tips?: string }) {
  return (
    <div className="metric-card">
      <img
        src="https://static.thenounproject.com/png/1201656-200.png"
        alt="FAQ"
        className="metric-card-img"
      />
      <div className="metric-card-content">
        <div className="metric-card-title">Domande più frequenti</div>
        <div className="metric-card-subtitle">Ultimi 30 giorni</div>

        <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 8 }}>
          {faqs.map(f => (
            <li key={f.question} style={{ fontSize: '0.9rem', marginBottom: 6 }}>
              <strong style={{ color: 'var(--accent)' }}>{f.count}×</strong>{' '}
              {f.question}
            </li>
          ))}
        </ul>

        {tips && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            {tips}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;

  return (
    <div className="metric-card insights-card">
      <img
        src="https://static.thenounproject.com/png/2230962-200.png"
        alt="Insights"
        className="metric-card-img"
      />
      <div className="metric-card-content">
        <div className="metric-card-title">Analisi conversazioni</div>
        <div className="metric-card-subtitle">Ultimi 30 giorni</div>

        {insights.slice(0, 3).map(ins => (
          <details key={ins.title} style={{ margin: '6px 0' }}>
            <summary style={{ cursor: 'pointer' }}>{ins.title}</summary>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {ins.body}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}