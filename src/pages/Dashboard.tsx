import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Dashboard.css';

// --- Interfacce e Costanti ---
const API = 'https://ai-backend-melorosso.onrender.com';
interface Session { session_id: string; created_at: string; updated_at: string; message_count: string; preview: string | null; avatarUrl?: string; }
interface Message { role: 'user' | 'assistant'; content: string; created_at: string; }
interface Faq { question: string; count: number; }
const LOREM_PICSUM_BASE_URL = 'https://picsum.photos/id/';
const AVATAR_SIZE = 200;
const MAX_PICSUM_ID = 1000;

// --- Funzioni Helper e Componenti UI ---
function getChatPctColor(pct: number) { if (pct >= 90) return '#ef4444'; if (pct >= 80) return '#f59e0b'; return 'var(--c-accent)'; }
const PERFORMANCE_LEVELS = { ottima: { label: 'Ottima', className: 'status-ottima', iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }, buona: { label: 'Buona', className: 'status-buona', iconPath: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }, male: { label: 'Migliorabile', className: 'status-male', iconPath: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0z' }, };
function getResponseTimeStatus(avgSeconds: number) { if (avgSeconds <= 0) return null; if (avgSeconds < 3) return PERFORMANCE_LEVELS.ottima; if (avgSeconds <= 4) return PERFORMANCE_LEVELS.buona; return PERFORMANCE_LEVELS.male; }
const CardIcon = ({ path }: { path: string }) => (<div className="metric-card-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg></div>);
function MetricCard({ iconPath, title, value, description, children }: { iconPath: string; title: React.ReactNode; value: React.ReactNode; description: React.ReactNode; children?: React.ReactNode; }) { return (<div className="metric-card"><div className="metric-card-header"><CardIcon path={iconPath} /><span className="metric-card-title">{title}</span></div><div className="metric-card-value">{value}</div><div className="metric-card-description">{description}</div>{children}</div>); }
function FaqSection({ faqs, tips }: { faqs: Faq[]; tips?: string }) { return faqs.length > 0 ? (<div className="content-section"><h2 className="section-title">Domande Frequenti</h2><p className="section-subtitle">Le domande più comuni emerse dalle conversazioni degli ultimi 30 giorni.</p><ul className="faq-list">{faqs.map(f => (<li key={f.question} className="faq-item"><span className="faq-question">{f.question}</span><span className="faq-count">{f.count} volte</span></li>))}</ul>{tips && <p className="section-tips">{tips}</p>}</div>) : null; }
function InsightsSection({ preview, slug }: { preview: string; slug: string }) { return preview ? (<div className="content-section"><h2 className="section-title">Analisi Conversazioni</h2><p className="section-subtitle">Un riassunto delle tendenze e dei punti chiave delle chat.</p><p className="insights-preview">{preview}</p><Link to={`/insights/${slug}`} className="section-link">Vai all'analisi dettagliata →</Link></div>) : null; }

export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { setToken } = useAuth();

  const [active, setAct] = useState(0);
  const [msgs, setMsgs] = useState(0);
  const [avgRes, setAvg] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [tips, setTips] = useState('');
  const [sessionsList, setSessionsList] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [insightPreview, setInsightPreview] = useState('');
  const [chatMonth, setChatMonth] = useState('');
  const [chatPct, setChatPct] = useState(0);
  const [availablePeriods, setAvailablePeriods] = useState<{ id: string; period_label: string }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [currentPeriodLabel, setCurrentPeriodLabel] = useState('Ciclo di Fatturazione Corrente');
  const [planName, setPlanName] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) return;
    const headers = { Authorization: `Bearer ${token}` };
    const handleAuthError = (res: Response) => { if (res.status === 401 || res.status === 403) { setToken(null); return true; } return false; };

    const fetchDataForPeriod = async () => {
      try {
        let subData: any, statsData: any;
        if (selectedPeriod) {
          setPlanName(null);
          setNextRenewalDate(null);

          const subRes = await fetch(`${API}/stats/subscription/historical-entry/${selectedPeriod}`, { headers });
          if (handleAuthError(subRes)) return;
          subData = await subRes.json();

          const statsRes = await fetch(`${API}/stats/${slug}?start_date=${subData.start_date}&end_date=${subData.renew_date}`, { headers });
          if (handleAuthError(statsRes)) return;
          statsData = await statsRes.json();
        } else {
          const subRes = await fetch(`${API}/stats/subscription/${slug}`, { headers });
          if (handleAuthError(subRes)) return;
          subData = await subRes.json();
          if (!subData || !subData.start_date) return;

          const statsRes = await fetch(`${API}/stats/${slug}?start_date=${subData.start_date}&end_date=${subData.renew_date}`, { headers });
          if (handleAuthError(statsRes)) return;
          statsData = await statsRes.json();
          setPlanId(subData.plan_id);
          setPlanName(subData.plan_name);
          const formattedRenewalDate = new Date(subData.renew_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
          setNextRenewalDate(formattedRenewalDate);

          const startDate = new Date(subData.start_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
          const renewDate = new Date(subData.renew_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
          setCurrentPeriodLabel(`Ciclo Corrente (${startDate} - ${renewDate})`);
        }
        setAct(statsData.active);
        setMsgs(statsData.totalMessages);
        setAvg(statsData.avgResponse);
        setSessionsCount(statsData.total_Sessions);
        setChatMonth(`${subData.chats_used} / ${subData.monthly_quota}`);
        setChatPct(subData.pct_used ? Math.round(subData.pct_used * 100) : 0);
      } catch (error) {
        console.error("Errore nel caricamento dei dati:", error);
      }
    };

    const fetchInitialData = async () => {
      try {
        const [historyRes, sessionsRes, faqRes, insightsRes] = await Promise.all([
          fetch(`${API}/stats/subscription/history/${slug}`, { headers }),
          fetch(`${API}/stats/sessions/${slug}`, { headers }),
          fetch(`${API}/stats/faq/${slug}?days=30`, { headers }),
          fetch(`${API}/stats/insights/${slug}?days=30`, { headers })
        ]);
        if ([historyRes, sessionsRes, faqRes, insightsRes].some(handleAuthError)) return;
        const [historyData, sessionsData, faqData, insightsData] = await Promise.all([historyRes.json(), sessionsRes.json(), faqRes.json(), insightsRes.json()]);
        setAvailablePeriods(historyData);
        setFaqs(faqData.faqs ?? []);
        setTips(faqData.tips ?? '');
        const { summary = '', bullets = [], actions = [] } = insightsData;
        let previewSrc = summary.trim() || bullets?.[0] || actions?.[0] || '';
        const MAX_PREVIEW = 250;
        const firstParagraph = previewSrc.split(/\n\n/)[0];
        setInsightPreview(firstParagraph.length > MAX_PREVIEW ? firstParagraph.slice(0, MAX_PREVIEW) + '…' : firstParagraph);
        const sessionsWithAvatars = (sessionsData as Session[]).map((s, idx) => ({ ...s, avatarUrl: `${LOREM_PICSUM_BASE_URL}${(idx % (MAX_PICSUM_ID - 50)) + 50}/${AVATAR_SIZE}` }));
        setSessionsList(sessionsWithAvatars);
      } catch (error) {
        console.error("Errore nel caricamento dei dati iniziali:", error);
      }
    };

    if (availablePeriods.length === 0) {
      fetchInitialData();
    }
    fetchDataForPeriod();
  }, [slug, selectedPeriod, setToken]);

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
  const BadgeIcon = ({ path }: { path: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>);
  const performanceStatus = getResponseTimeStatus(avgRes);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Dashboard di {(slug)?.replace(/-/g, ' ')}</h1>
        <p>Panoramica delle performance e delle conversazioni del tuo assistente AI.</p>

        {planName && nextRenewalDate &&(
          <div className={`subscription-infocard plan--${planId}`}>
            <div className="infocard-icon">
              <svg fill="#000000" width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" data-name="Layer 1"><path d="M17,2H5A1,1,0,0,0,4,3V19a1,1,0,0,0,1,1H6v1a1,1,0,0,0,1,1H7a1,1,0,0,0,1-1V20h9a3,3,0,0,0,3-3V5A3,3,0,0,0,17,2ZM14,18H6V4h8Zm4-1a1,1,0,0,1-1,1H16V4h1a1,1,0,0,1,1,1Z"/></svg>
            </div>
            <div className="infocard-details">
              <span className="plan-name"><strong>{planName}</strong></span>
              <span className="renewal-date">Si rinnova il {nextRenewalDate}</span>
            </div>
            <a
              href={`mailto:info@melorosso.it?subject=Richiesta modifica/disdetta piano per ${slug}`}
              className="change-plan-link"
            >
              Cambia o cancella
            </a>
          </div>
        )}

        <div className="month-selector-wrapper">
          <select className="month-selector" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            <option key="current" value="">{currentPeriodLabel}</option>
            {availablePeriods.map((period) => (<option key={period.id} value={period.id}>{period.period_label}</option>))}
          </select>
        </div>

        
      </header>

      <main>
        <div className="metrics-grid">
          <MetricCard iconPath="M3 21h2V3H3v18zm8 0h2V12h-2v9zm8 0h2V16h-2v5z" title="Uso Chat Mensili" value={chatMonth} description={<span style={{ color: getChatPctColor(chatPct) }}>Hai usato il {chatPct}% delle conversazioni</span>}>
            <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${chatPct}%`, backgroundColor: getChatPctColor(chatPct) }}></div></div>
            {chatPct >= 100 && (<a className="limit-reached-link" href="mailto:info@melorosso.it?subject=Richiesta%20aumento%20limite%20chat">Contattaci per aumentare il limite</a>)}
          </MetricCard>
          <MetricCard iconPath="M2.5 10.5 a15 15 0 0 1 19 0 M5.5 13.5 a10 10 0 0 1 13 0 M8.5 16.5 a5 5 0 0 1 7 0 M12 20 v.01" title="Sessioni attive" value={active} description="Conversazioni nell'ultima ora" />
          <MetricCard iconPath="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" title="Messaggi totali" value={msgs.toLocaleString('it-IT')} description="Nel periodo selezionato" />
          <MetricCard iconPath="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 12l4-4" title="Velocità risposta" value={`${avgRes} secondi`} description="Tempo di risposta medio">
            {performanceStatus && (<div className={`performance-badge ${performanceStatus.className}`}><BadgeIcon path={performanceStatus.iconPath} /><span>{performanceStatus.label}</span></div>)}
          </MetricCard>
        </div>

        <div className="content-sections-grid">
          <FaqSection faqs={faqs} tips={tips} />
          <InsightsSection preview={insightPreview} slug={slug!} />
        </div>

        <div className="chat-viewer-container">
          <div className={`session-list-pane ${selectedSessionId ? 'mobile-hidden' : ''}`}>
            <div className="session-list-header"><h2>Conversazioni Recenti</h2></div>
            <div className="session-list">
              {sessionsList.length > 0 ? (sessionsList.map((s) => (<div key={s.session_id} className={`session-item ${selectedSessionId === s.session_id ? 'active' : ''}`} onClick={() => handleOpenChat(s.session_id)}><img src={s.avatarUrl} alt="avatar" className="session-avatar" /><div className="session-details"><div className="session-info"><span className="session-id">Sessione ...{s.session_id.slice(-6)}</span><span className="session-time">{new Date(s.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span></div><p className="session-preview">{s.preview || 'Nessun messaggio'}</p></div></div>))) : (<p className="empty-state-message">Nessuna sessione trovata.</p>)}
            </div>
          </div>
          <div className={`message-pane ${selectedSessionId ? 'mobile-visible' : ''}`}>
            {selectedSessionId ? (<><div className="message-pane-header"><button className="back-button" onClick={handleCloseChat}>←</button><h3>Dettaglio Chat</h3><span>ID: ...{selectedSessionId.slice(-6)}</span></div><div className="message-list">{isLoadingChat ? (<p className="empty-state-message">Caricamento...</p>) : (chatMessages.map((msg, i) => (<div key={i} className={`message-bubble-wrapper message-from-${msg.role}`}><div className="message-bubble">{msg.content}</div></div>)))}</div></>) : (<div className="empty-state-message"><p>Seleziona una conversazione per visualizzarne i dettagli.</p></div>)}
          </div>
        </div>
      </main>
    </div>
  );
}