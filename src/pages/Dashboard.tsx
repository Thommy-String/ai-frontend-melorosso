// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext'; // <-- AGGIUNGI QUESTA RIGA
import './Dashboard.css';

// Interfacce e costanti API rimangono invariate
const API = 'https://ai-backend-melorosso.onrender.com';
interface Session { session_id: string; created_at: string; updated_at: string; message_count: string; preview: string | null; avatarUrl?: string; }
interface Message { role: 'user' | 'assistant'; content: string; created_at: string; }
interface Faq { question: string; count: number }
interface Insight { title: string; body: string; }
const LOREM_PICSUM_BASE_URL = 'https://picsum.photos/id/';
const AVATAR_SIZE = 200;
const MAX_PICSUM_ID = 1000;

// --- Helper Functions ---
function getChatPctColor(pct: number) {
  if (pct >= 90) return '#ef4444'; // Rosso più intenso
  if (pct >= 80) return '#f59e0b'; // Ambra
  return 'var(--c-accent)';
}

// NUOVA STRUTTURA DATI per i livelli di performance
const PERFORMANCE_LEVELS = {
  ottima: {
    label: 'Ottima',
    className: 'status-ottima',
    iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' // check-circle
  },
  buona: {
    label: 'Buona',
    className: 'status-buona',
    iconPath: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' // alert-triangle
  },
  male: {
    label: 'Migliorabile',
    className: 'status-male',
    iconPath: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0z' // x-circle
  },
};

// NUOVA FUNZIONE per ottenere lo stato della performance
function getResponseTimeStatus(avgSeconds: number) {
  if (avgSeconds <= 0) return null; // Non mostrare nulla se il valore non è valido
  if (avgSeconds < 3) return PERFORMANCE_LEVELS.ottima;
  if (avgSeconds <= 4) return PERFORMANCE_LEVELS.buona;
  return PERFORMANCE_LEVELS.male;
}

// --- Componenti UI Ridisegnati ---

// Icona per le card (SVG inline per non dipendere da file esterni)
const CardIcon = ({ path }: { path: string }) => (
  <div className="metric-card-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
  </div>
);

// Componente MetricCard ridisegnato
function MetricCard({ iconPath, title, value, description, children }: { iconPath: string; title: React.ReactNode; value: React.ReactNode; description: React.ReactNode; children?: React.ReactNode; }) {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <CardIcon path={iconPath} />
        <span className="metric-card-title">{title}</span>
      </div>
      <div className="metric-card-value">{value}</div>
      <div className="metric-card-description">{description}</div>
      {children}
    </div>
  );
}

// Sezione FAQ ridisegnata
function FaqSection({ faqs, tips }: { faqs: Faq[]; tips?: string }) {
  return (
    <div className="content-section">
      <h2 className="section-title">Domande Frequenti</h2>
      <p className="section-subtitle">Le domande più comuni emerse dalle conversazioni degli ultimi 30 giorni.</p>
      <ul className="faq-list">
        {faqs.map(f => (
          <li key={f.question} className="faq-item">
            <span className="faq-question">{f.question}</span>
            <span className="faq-count">{f.count} volte</span>
          </li>
        ))}
      </ul>
      {tips && <p className="section-tips">{tips}</p>}
    </div>
  );
}

// Sezione Insights ridisegnata
function InsightsSection({ preview, slug }: { preview: string; slug: string }) {
  return (
    <div className="content-section">
      <h2 className="section-title">Analisi Conversazioni</h2>
      <p className="section-subtitle">Un riassunto delle tendenze e dei punti chiave delle chat.</p>
      <p className="insights-preview">{preview}</p>
      <Link to={`/insights/${slug}`} className="section-link">
        Vai all'analisi dettagliata →
      </Link>
    </div>
  );
}


// --- Componente Principale Dashboard ---

export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { setToken } = useAuth();
  const [active, setAct] = useState(0);
  const [msgs, setMsgs] = useState(0);
  const [avgRes, setAvg] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [faqs, setFaqs] = useState<{ q: string; count: number }[]>([]);
  const [tips, setTips] = useState('');
  const [sessionsList, setSessionsList] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [insightPreview, setInsightPreview] = useState('');
  const [chatMonth, setChatMonth] = useState('');
  const [chatPct, setChatPct] = useState(0);
  // STATO PER LA SELEZIONE DEL MESE
  const [availableMonths, setAvailableMonths] = useState<{ month_value: string; month_label: string; }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // yyyy-mm, stringa vuota per il mese corrente
  const performanceStatus = getResponseTimeStatus(avgRes);


  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) {
      // Se non c'è token, il router gestirà il reindirizzamento.
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    // Formatta il mese selezionato per la query API (es. '2025-07' -> '202507')
    const yyyymm = selectedMonth ? selectedMonth.replace('-', '') : '';
    
    // Funzione helper per gestire l'errore di autenticazione in modo centralizzato
    const handleAuthError = (res: Response) => {
        if (res.status === 401 || res.status === 403) {
            console.error("Token non valido o scaduto. Eseguo il logout forzato.");
            setToken(null); // Cancella il token e interrompe il ciclo
            return true;
        }
        return false;
    };

    // --- Funzione per caricare i dati che cambiano con il mese ---
    const fetchDataForMonth = async () => {
        // Costruisce gli URL dinamicamente in base al mese selezionato
        const statsUrl = yyyymm ? `${API}/stats/${slug}?yyyymm=${yyyymm}` : `${API}/stats/${slug}`;
        const subUrl = yyyymm ? `${API}/stats/subscription/${slug}?yyyymm=${yyyymm}` : `${API}/stats/subscription/${slug}`;

        try {
            const [statsRes, subRes] = await Promise.all([
                fetch(statsUrl, { headers }),
                fetch(subUrl, { headers })
            ]);

            if (handleAuthError(statsRes) || handleAuthError(subRes)) return;

            const statsData = await statsRes.json();
            const subData = await subRes.json();

            // Aggiorna gli stati con i dati del mese selezionato
            setAct(statsData.active);
            setMsgs(statsData.totalMessages);
            setAvg(statsData.avgResponse);
            setSessionsCount(statsData.total_Sessions);
            setChatMonth(`${subData.chats_used} / ${subData.monthly_quota}`);
            setChatPct(Math.round(subData.pct_used * 100));

        } catch (error) {
            console.error("Errore nel fetch dei dati del mese:", error);
        }
    };

    // --- Funzione per caricare i dati iniziali (che non cambiano) ---
    const fetchInitialData = async () => {
        try {
            const responses = await Promise.all([
                fetch(`${API}/stats/sessions/${slug}`, { headers }),
                fetch(`${API}/stats/subscription/history/${slug}`, { headers }),
                fetch(`${API}/stats/faq/${slug}?days=30`, { headers }),
                fetch(`${API}/stats/insights/${slug}?days=30`, { headers })
            ]);
            
            if (responses.some(handleAuthError)) return;

            const [sessionsData, monthsData, faqData, insightsData] = await Promise.all(responses.map(res => res.json()));
            
            // Aggiungi l'opzione "Mese Corrente" in cima alla lista per il selettore
            setAvailableMonths([
                { month_value: '', month_label: 'Mese Corrente' },
                ...monthsData
            ]);

            // Imposta gli altri stati che non dipendono dal mese
            setFaqs(faqData.faqs ?? []);
            setTips(faqData.tips ?? '');
            
            const { summary = '', bullets = [], actions = [] } = insightsData;
            let previewSrc = summary.trim() || bullets[0] || actions[0] || '';
            const MAX_PREVIEW = 250;
            const firstParagraph = previewSrc.split(/\n\n|\r\n\r\n/)[0];
            setInsightPreview(
              firstParagraph.length > MAX_PREVIEW 
                ? firstParagraph.slice(0, MAX_PREVIEW) + '…' 
                : firstParagraph
            );

            const sessionsWithAvatars = (sessionsData as Session[]).map((s, idx) => ({ 
              ...s, 
              avatarUrl: `${LOREM_PICSUM_BASE_URL}${(idx % (MAX_PICSUM_ID - 50)) + 50}/${AVATAR_SIZE}` 
            }));
            setSessionsList(sessionsWithAvatars);

        } catch (error) {
             console.error("Errore nel fetch dei dati iniziali:", error);
        }
    };
    
    // Esegui le chiamate
    if (availableMonths.length === 0) {
        fetchInitialData();
    }
    fetchDataForMonth();

  }, [slug, nav, setToken, selectedMonth]); // Ricarica i dati quando il mese selezionato cambia

  const handleOpenChat = (sessionId: string) => {
    const token = localStorage.getItem('jwt');
    if (!token) return;
    setSelectedSessionId(sessionId);
    setIsLoadingChat(true);
    setChatMessages([]);
    fetch(`${API}/chat/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setChatMessages(data.chatLogs || []))
      .catch(console.error)
      .finally(() => setIsLoadingChat(false));
  };
  const handleCloseChat = () => setSelectedSessionId(null);
  const BadgeIcon = ({ path }: { path: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
);

  // --- RETURN STATEMENT RIDISEGNATO ---
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Dashboard di {(slug)?.replace(/-/g, ' ')}</h1>
        <p>Panoramica delle performance e delle conversazioni del tuo assistente AI.</p>
        {availableMonths.length > 1 && (
            <div className="month-selector-wrapper">
                <select 
                    className="month-selector"
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                >
                    {availableMonths.map(month => (
                        <option key={month.month_value} value={month.month_value}>
                            {month.month_label}
                        </option>
                    ))}
                </select>
            </div>
        )}
      </header>

      <main>
        <div className="metrics-grid">
          <MetricCard iconPath="M12 20v-6M6 20v-2M18 20v-4" title="Sessioni attive" value={active} description="Conversazioni nell'ultima ora" />
          <MetricCard iconPath="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" title="Messaggi totali" value={msgs.toLocaleString('it-IT')} description="Dall'inizio del servizio" />
          <MetricCard
            iconPath="m.5 1 6 6-6 6"
            title="Velocità risposta"
            value={`${avgRes}s`}
            description="Tempo di risposta medio"
          >
            {/* Aggiungiamo il badge di performance come "children" */}
            {performanceStatus && (
              <div className={`performance-badge ${performanceStatus.className}`}>
                <BadgeIcon path={performanceStatus.iconPath} />
                <span>{performanceStatus.label}</span>
              </div>
            )}
          </MetricCard>          <MetricCard iconPath="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" title="Conversazioni totali" value={sessionsCount.toLocaleString('it-IT')} description="Dall'inizio del servizio" />

          {chatMonth && (
            <MetricCard
              iconPath="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              title="Utilizzo Chat Mensile"
              value={chatMonth}
              description={
                <span style={{ color: getChatPctColor(chatPct) }}>
                  Utilizzato il {chatPct}% del limite
                </span>
              }
            >
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${chatPct}%`, backgroundColor: getChatPctColor(chatPct) }}></div>
              </div>
              {chatPct >= 100 && (
                <a className="limit-reached-link" href="mailto:info@melorosso.it?subject=Richiesta%20aumento%20limite%20chat">
                  Contattaci per aumentare il limite
                </a>
              )}
            </MetricCard>
          )}
        </div>

        <div className="content-sections-grid">
          {faqs.length > 0 && <FaqSection faqs={faqs.slice(0, 5)} tips={tips} />}
          {insightPreview && <InsightsSection preview={insightPreview} slug={slug!} />}
        </div>

        <div className="chat-viewer-container">
          <div className={`session-list-pane ${selectedSessionId ? 'mobile-hidden' : ''}`}>
            <div className="session-list-header">
              <h2>Conversazioni Recenti</h2>
            </div>
            <div className="session-list">
              {sessionsList.length > 0 ? (
                sessionsList.map((s) => (
                  <div key={s.session_id} className={`session-item ${selectedSessionId === s.session_id ? 'active' : ''}`} onClick={() => handleOpenChat(s.session_id)}>
                    <img src={s.avatarUrl} alt="avatar" className="session-avatar" />
                    <div className="session-details">
                      <div className="session-info">
                        <span className="session-id">Sessione ...{s.session_id.slice(-6)}</span>
                        <span className="session-time">{new Date(s.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className="session-preview">{s.preview || 'Nessun messaggio'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state-message">Nessuna sessione trovata.</p>
              )}
            </div>
          </div>

          <div className={`message-pane ${selectedSessionId ? 'mobile-visible' : ''}`}>
            {selectedSessionId ? (
              <>
                <div className="message-pane-header">
                  <button className="back-button" onClick={handleCloseChat}>←</button>
                  <h3>Dettaglio Chat</h3>
                  <span>ID: ...{selectedSessionId.slice(-6)}</span>
                </div>
                <div className="message-list">
                  {isLoadingChat ? (
                    <p className="empty-state-message">Caricamento...</p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`message-bubble-wrapper message-from-${msg.role}`}>
                        <div className="message-bubble">{msg.content}</div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state-message">
                <p>Seleziona una conversazione per visualizzarne i dettagli.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}