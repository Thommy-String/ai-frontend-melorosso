import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Dashboard.css';
import ContactRequestsSection, { type ContactRequest } from '../ContactRequestSection';
import ChatHistoryViewer from '../ChatHistoryViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getSubscriptionData,
  getHistoricalSubscriptionData,
  getDashboardStats,
  getRecentSessions,
  getFaqs,
  getInsights,
  getContactRequests,
  getSubscriptionHistory,
  getChatHistory,
} from '../api/api';

/* ------------------------------------------------------------------
 *  TYPE DEFINITIONS
 * ------------------------------------------------------------------ */

type ButtonMsg = { type: 'button'; label: string; action: string; class?: string };
type MapCardData = { title: string; embedUrl: string; linkUrl: string };
type MapCardMsg = { type: 'map_card'; data: MapCardData };
// Extend ParsedMsg with the new message types
// (assumes TextMsg | ProductCardMsg already defined elsewhere)
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ParsedMsg = TextMsg | ProductCardMsg | ButtonMsg | MapCardMsg;
type TextMsg = { type: 'text'; content: string };
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type ProductCardMsg = { type: 'product_card'; data: any };

/* ------------------------------------------------------------------
 *  CONSTANTS & HELPERS
 * ------------------------------------------------------------------ */

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const LOREM_PICSUM_BASE_URL = 'https://picsum.photos/id/';
const AVATAR_SIZE = 200;
const MAX_PICSUM_ID = 1000;
const CONTACTS_PAGE_SIZE = 5;

interface Session {
  session_id: string;
  created_at: string;
  updated_at: string;
  message_count: string;
  preview: string | null;
  avatarUrl?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Faq {
  question: string;
  count: number;
}

interface PeriodEntry {
  id: string;
  period_label: string;
  start_date: string;
  renew_date: string;
  plan_id: string;
  plan_name: string;
  chats_used: number;
  monthly_quota: number;
  pct_used: number;
}

function getChatPctColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return 'var(--c-accent)';
}

const PERFORMANCE_LEVELS = {
  ottima: {
    label: 'Ottima',
    className: 'status-ottima',
    iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14',
  },
  buona: {
    label: 'Buona',
    className: 'status-buona',
    iconPath: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  },
  male: {
    label: 'Migliorabile',
    className: 'status-male',
    iconPath: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  },
} as const;

function getResponseTimeStatus(avgSeconds: number) {
  if (avgSeconds <= 0) return null;
  if (avgSeconds < 3) return PERFORMANCE_LEVELS.ottima;
  if (avgSeconds <= 4) return PERFORMANCE_LEVELS.buona;
  return PERFORMANCE_LEVELS.male;
}

const CardIcon: React.FC<{ path: string }> = ({ path }) => (
  <div className="metric-card-icon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  </div>
);

const MetricCard: React.FC<{
  iconPath: string;
  title: React.ReactNode;
  value: React.ReactNode;
  description: React.ReactNode;
  children?: React.ReactNode;
}> = ({ iconPath, title, value, description, children }) => (
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

const FaqSection: React.FC<{ faqs: Faq[]; tips?: string }> = ({ faqs, tips }) =>
  faqs.length > 0 ? (
    <div className="content-section">
      <h2 className="section-title">Domande Frequenti</h2>
      <p className="section-subtitle">
        Le domande più comuni emerse dalle conversazioni degli ultimi 30 giorni.
      </p>
      <ul className="faq-list">
        {faqs.map((f) => (
          <li key={f.question} className="faq-item">
            <span className="faq-question">{f.question}</span>
            <span className="faq-count">{f.count} volte</span>
          </li>
        ))}
      </ul>
      {tips && <p className="section-tips">{tips}</p>}
    </div>
  ) : null;

const InsightsSection: React.FC<{ preview: string; slug: string }> = ({ preview, slug }) =>
  preview ? (
    <div className="content-section">
      <h2 className="section-title">Analisi Conversazioni</h2>
      <p className="section-subtitle">
        Un riassunto delle tendenze e dei punti chiave delle chat.
      </p>
      <p className="insights-preview">{preview}</p>
      <Link to={`/insights/${slug}`} className="section-link">
        Vai all'analisi dettagliata →
      </Link>
    </div>
  ) : null;


  function renderMessageContent(msg: Message) {
    if (msg.role === 'user') {
      return <div className="message-bubble">{msg.content}</div>;
    }

    try {
      const parsedContent = JSON.parse(msg.content) as ParsedMsg[];

      if (Array.isArray(parsedContent)) {
        return parsedContent.map((item, index) => {
          switch (item.type) {
            case 'text':
              return (
                <div key={index} className="message-bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                </div>
              );
            case 'product_card':
              return (
                <a
                  key={index}
                  href={item.data.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="product-card-viewer"
                >
                  <img
                    src={item.data.imageUrl}
                    alt={item.data.title}
                    className="product-card-image-viewer"
                  />
                  <div className="product-card-info-viewer">
                    <div className="product-card-title-viewer">{item.data.title}</div>
                    <div className="product-card-price-viewer">{item.data.price}</div>
                  </div>
                </a>
              );
            case 'button':
              return (
                <a
                  key={index}
                  href={item.action}
                  className={`chat-button-viewer ${item.class || ''}`}
                >
                  {item.label}
                </a>
              );
            case 'map_card':
              return (
                <div key={index} className="map-card-viewer">
                  <iframe
                    src={item.data.embedUrl}
                    width="100%"
                    height="180"
                    loading="lazy"
                    style={{ border: 0 }}
                    allowFullScreen
                  />
                  <div className="map-card-footer-viewer">
                    <a
                      href={item.data.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.data.title} - Apri su Google Maps
                    </a>
                  </div>
                </div>
              );
            default:
              return null;
          }
        });
      }
    } catch (error) {
      // Fallback: plain markdown
      return (
        <div className="message-bubble">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
      );
    }

    return null;
  }


/* ------------------------------------------------------------------
 *  COMPONENT
 * ------------------------------------------------------------------ */

export default function Dashboard() {
  const { slug } = useParams<{ slug?: string }>(); // slug is optional
  const { token, setToken } = useAuth();

  /* ------------------------------ STATE ------------------------------ */
  // Metrics
  const [active, setActive] = useState(0);
  const [msgs, setMsgs] = useState(0);
  const [avgRes, setAvgRes] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);

  // Subscription & period
  const [availablePeriods, setAvailablePeriods] = useState<
    { id: string; period_label: string }[]
  >([]); const [selectedPeriod, setSelectedPeriod] = useState('');
  const [currentPeriodLabel] = useState('Ciclo di Fatturazione Corrente');
  const [planName, setPlanName] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState<string | null>(null);
  const [chatMonth, setChatMonth] = useState('');
  const [chatPct, setChatPct] = useState(0);

  // Conversation related
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [tips, setTips] = useState('');
  const [sessionsList, setSessionsList] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [insightPreview, setInsightPreview] = useState('');
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [contactsOffset, setContactsOffset] = useState(0);
  const [selectedContact, setSelectedContact] = useState<ContactRequest | null>(null);
  const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  /* ------------------------------ FETCH HELPERS ------------------------------ */

  const handleAuthError = useCallback(
    (res: Response) => {
      if (res.status === 401 || res.status === 403) {
        setToken(null);
        return true;
      }
      return false;
    },
    [setToken]
  );

  /* ------------------------------ LOAD STATIC DATA ------------------------------ */

  const loadStaticData = useCallback(async () => {
    if (!slug || !token) return;
    try {
      const [sessions, faqsData, insightsData, contacts, history] = await Promise.all([
        getRecentSessions(slug, token),
        getFaqs(slug, token),
        getInsights(slug, token),
        getContactRequests(slug, 0, token),
        getSubscriptionHistory(slug, token),
      ]);

      console.log('>> history', history);

      setSessionsList(
        sessions.map((s: Session, idx: number) => ({
          ...s,
          avatarUrl: `${LOREM_PICSUM_BASE_URL}${(idx % (MAX_PICSUM_ID - 50)) + 50}/${AVATAR_SIZE}`,
        }))
      );

      setFaqs(faqsData.faqs ?? []);
      setTips(faqsData.tips ?? '');
      setInsightPreview(
        (insightsData.summary || '')
          .trim()
          .slice(0, 250)
          .concat(insightsData.summary ? '…' : '')
      );

      setContactRequests(contacts.requests ?? []);
      setHasMoreContacts((contacts.requests?.length || 0) < contacts.total);
      setContactsOffset(CONTACTS_PAGE_SIZE);

      setAvailablePeriods(history);
    } catch (error) {
      console.error('Errore nel caricamento dei dati statici:', error);
    }
  }, [slug, token]);

  /* ------------------------------ LOAD PERIOD-DEPENDENT DATA ------------------------------ */

  const loadPeriodData = useCallback(async () => {
    if (!slug || !token) return;

    try {
      let subData: Awaited<ReturnType<typeof getSubscriptionData>>;
      let statsData: Awaited<ReturnType<typeof getDashboardStats>>;

      if (selectedPeriod) {
        subData = await getHistoricalSubscriptionData(selectedPeriod, token);
        if (!subData) return;

        statsData = await getDashboardStats(slug!, token, {
          start_date: subData.start_date,
          end_date: subData.renew_date,
        });
      } else {
        subData = await getSubscriptionData(slug, token);
        if (!subData?.start_date) return;
        statsData = await getDashboardStats(slug, token, {
          start_date: subData.start_date,
          end_date: subData.renew_date,
        });
      }

      // Update subscription info
      setPlanId(subData.plan_id);
      setPlanName(subData.plan_name);
      setNextRenewalDate(subData.renew_date);

      // Update quota usage
      setChatMonth(`${subData.chats_used} / ${subData.monthly_quota}`);
      setChatPct(subData.pct_used ? Math.round(subData.pct_used * 100) : 0);

      // Update stats
      setActive(statsData.active);
      setMsgs(statsData.totalMessages);
      setAvgRes(statsData.avgResponse);
      setSessionsCount(statsData.total_Sessions);
    } catch (error) {
      console.error('Errore nel caricamento dei dati del periodo:', error);
    }
  }, [slug, token, selectedPeriod]);

  /* ------------------------------ EFFECTS ------------------------------ */

  useEffect(() => {
    loadStaticData();
  }, [loadStaticData]);

  useEffect(() => {
    loadPeriodData();
  }, [loadPeriodData]);

  /* ------------------------------ EVENT HANDLERS ------------------------------ */

  const handleLoadMoreContacts = async () => {
    if (!slug || !token) return;
    try {
      const data = await getContactRequests(slug, contactsOffset, token);
      setContactRequests((prev) => [...prev, ...data.requests]);
      setHasMoreContacts(contactRequests.length + data.requests.length < data.total);
      setContactsOffset((prev) => prev + CONTACTS_PAGE_SIZE);
    } catch (error) {
      console.error('Errore caricamento altri contatti', error);
    }
  };

  const handleOpenContactChat = (request: ContactRequest) => {
    if (!token) return;
    setSelectedContact(request);
    setIsLoadingHistory(true);
    setHistoryMessages([]);
    // Use the correct, token-aware function
    getChatHistory(request.session_id, token)
      .then((data) => {
        setHistoryMessages(data.chatLogs || []);
      })
      .catch((err) => console.error('Errore cronologia chat:', err))
      .finally(() => setIsLoadingHistory(false));
  }

  const handleOpenChat = (sessionId: string) => {
    if (!token) return;
    setSelectedSessionId(sessionId);
    setIsLoadingChat(true);
    setChatMessages([]);
    // Use the correct, token-aware function
    getChatHistory(sessionId, token)
      .then((data: { chatLogs?: Message[] }) => {
        setChatMessages(data.chatLogs || []);
      })
      .catch(console.error)
      .finally(() => setIsLoadingChat(false));
  };

  const handleCloseViewer = () => setSelectedContact(null);

  const handleCloseChat = () => setSelectedSessionId(null);

  const performanceStatus = getResponseTimeStatus(avgRes);

  /* ------------------------------------------------------------------
   *  RENDER
   * ------------------------------------------------------------------ */

  return (
    <>
      {/* Contact chat history overlay */}
      <ChatHistoryViewer
        isOpen={!!selectedContact}
        onClose={handleCloseViewer}
        messages={historyMessages}
        isLoading={isLoadingHistory}
        contactInfo={selectedContact}
      />

      <div className="dashboard-page">
        {/* ------------------------------ HEADER ------------------------------ */}
        <header className="dashboard-header">
          <h1>Dashboard di {slug?.replace(/-/g, ' ')}</h1>
          <p>Panoramica delle performance e delle conversazioni del tuo assistente AI.</p>

          {planName && nextRenewalDate && (
            <div className={`subscription-infocard plan--${planId}`}>
              <div className="infocard-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="infocard-details">
                <span className="plan-name">
                  <strong>{planName}</strong>
                </span>
                <span className="renewal-date">
                  Rinnovo {new Date(nextRenewalDate!)
                    .toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                </span>              </div>
              <a
                href={`mailto:info@melorosso.it?subject=Richiesta modifica/disdetta piano per ${slug}`}
                className="change-plan-link"
              >
                Cambia o cancella
              </a>
            </div>
          )}

          <div className="month-selector-wrapper">
            <select
              className="month-selector"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option key="current" value="">
                {currentPeriodLabel}
              </option>
              {availablePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* ------------------------------ MAIN ------------------------------ */}
        <main>
          {/* Metrics */}
          <div className="metrics-grid">
            <MetricCard
              iconPath="M3 21h2V3H3v18zm8 0h2V12h-2v9zm8 0h2V16h-2v5z"
              title="Chat usate"
              value={chatMonth}
              description={
                <span style={{ color: getChatPctColor(chatPct) }}>
                  Utilizzato il {chatPct}% del limite
                </span>
              }
            >
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${chatPct}%`, backgroundColor: getChatPctColor(chatPct) }}
                />
              </div>
              {chatPct >= 100 && (
                <a
                  className="limit-reached-link"
                  href="mailto:info@melorosso.it?subject=Richiesta%20aumento%20limite%20chat"
                >
                  Contattaci per aumentare il limite
                </a>
              )}
            </MetricCard>

            <MetricCard
              iconPath="M2.5 10.5 a15 15 0 0 1 19 0 M5.5 13.5 a10 10 0 0 1 13 0 M8.5 16.5 a5 5 0 0 1 7 0 M12 20 v.01"
              title="Utenti online"
              value={active}
              description="Conversazioni nell'ultima ora"
            />

            <MetricCard
              iconPath="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              title="Messaggi scambiati"
              value={msgs.toLocaleString('it-IT')}
              description="Nel periodo selezionato"
            />

            <MetricCard
              iconPath="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 12l4-4"
              title="Velocità risposta"
              value={`${avgRes}s`}
              description="Tempo di risposta medio"
            >
              {performanceStatus && (
                <div className={`performance-badge ${performanceStatus.className}`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={performanceStatus.iconPath} />
                  </svg>
                  <span>{performanceStatus.label}</span>
                </div>
              )}
            </MetricCard>
          </div>

          {/* Contact requests */}
          {contactRequests.length > 0 && (
            <ContactRequestsSection
              requests={contactRequests}
              onShowHistory={handleOpenContactChat}
              hasMore={hasMoreContacts}
              onLoadMore={handleLoadMoreContacts}
            />
          )}

          {/* FAQ + Insights */}
          <div className="content-sections-grid">
            <FaqSection faqs={faqs} tips={tips} />
            {slug && <InsightsSection preview={insightPreview} slug={slug} />}
          </div>

          {/* Chat viewer */}
          <div className="chat-viewer-container">
            {/* Left panel: sessions list */}
            <div className={`session-list-pane ${selectedSessionId ? 'mobile-hidden' : ''}`}>
              <div className="session-list-header">
                <h2>Conversazioni Recenti</h2>
              </div>
              <div className="session-list">
                {sessionsList.length > 0 ? (
                  sessionsList.map((s) => (
                    <div
                      key={s.session_id}
                      className={`session-item ${selectedSessionId === s.session_id ? 'active' : ''}`}
                      onClick={() => handleOpenChat(s.session_id)}
                    >
                      <img src={s.avatarUrl} alt="avatar" className="session-avatar" />
                      <div className="session-details">
                        <div className="session-info">
                          <span className="session-id">Sessione …{s.session_id.slice(-6)}</span>
                          <span className="session-time">
                            {new Date(s.updated_at).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
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

            {/* Right panel: selected chat */}
            <div className={`message-pane ${selectedSessionId ? 'mobile-visible' : ''}`}>
              {!selectedSessionId ? (
                <div className="empty-state-message">
                  <p>Seleziona una conversazione per visualizzarne i dettagli.</p>
                </div>
              ) : (
                <>
                  <div className="message-pane-header">
                    <button className="back-button" onClick={handleCloseChat}>
                      ←
                    </button>
                    <h3>Dettaglio Chat</h3>
                    <span>ID: …{selectedSessionId.slice(-6)}</span>
                  </div>

                  <div className="message-list">
                    {isLoadingChat ? (
                      <p className="empty-state-message">Caricamento…</p>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`message-bubble-wrapper message-from-${msg.role}`}
                        >
                          {renderMessageContent(msg)}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );

  
}
