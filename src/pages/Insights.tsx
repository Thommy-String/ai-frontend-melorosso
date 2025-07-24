// src/pages/Insights.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import './Insights.css';

const API = 'https://ai-backend-melorosso.onrender.com';

// --- Icon Components ---
const InsightIcon = () => (
  <div className="item-icon-wrapper insight-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5 6 6 0 0 1 6-5 6 6 0 0 1 6 5z"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="m4.22 4.22 1.42 1.42"/><path d="m18.36 18.36 1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="m4.22 19.78 1.42-1.42"/><path d="m18.36 5.64 1.42-1.42"/></svg>
  </div>
);

const ActionIcon = () => (
  <div className="item-icon-wrapper action-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  </div>
);


export default function InsightsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [summary, setSummary] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // La logica di fetch dei dati rimane invariata
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) { nav('/login'); return; }
    fetch(`${API}/stats/insights/${slug}?days=30`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if ([401, 403].includes(r.status)) throw new Error('auth');
        if (!r.ok) throw new Error('fetch_failed');
        return r.json();
      })
      .then(j => {
        setSummary(j.summary ?? '');
        setBullets(j.bullets ?? []);
        setActions(j.actions ?? []);
      })
      .catch(err => {
        if (err.message === 'auth') nav('/login');
        else setError('Impossibile caricare le analisi in questo momento.');
      })
      .finally(() => setLoading(false));
  }, [slug, nav]);

  // UI per stati di caricamento ed errore
  if (loading) return <p className="page-state-message">Caricamento analisi...</p>;
  if (error) return <p className="page-state-message error">{error}</p>;

  return (
    <div className="insights-page">
      <header className="insights-header">
        <div>
          <h1 className="insights-title">Analisi Conversazioni</h1>
          <p className="insights-subtitle">Riepilogo per {slug.replace(/-/g, ' ')}</p>
        </div>
        <Link to={`/dashboard/${slug}`} className="back-to-dashboard-link">
          ← Torna alla Dashboard
        </Link>
      </header>

      <main>
        {summary && (
          <section className="summary-section">
            <h2>Panoramica Generale</h2>
            <p>{summary.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>
          </section>
        )}

        <div className="insights-grid">
          <div className="content-card">
            <h3 className="card-title">Punti Chiave Emersi</h3>
            {bullets.length > 0 ? (
              <ul className="item-list">
                {bullets.map((b, i) => (
                  <li key={i} className="insight-item">
                    <InsightIcon />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="empty-card-message">Nessun punto chiave disponibile.</p>}
          </div>

          <div className="content-card">
            <h3 className="card-title">Azioni Consigliate</h3>
            {actions.length > 0 ? (
              <ul className="item-list">
                {actions.map((a, i) => (
                  <li key={i} className="action-item">
                    <ActionIcon />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="empty-card-message">Nessuna azione consigliata per ora.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}