// src/pages/Insights.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import './Insights.css';

const API = 'https://ai-backend-melorosso.onrender.com';

export default function InsightsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const nav            = useNavigate();

  const [summary, setSummary] = useState('');      // NEW
  const [bullets, setBullets] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  /* ---------- fetch ------------------------------------------------ */
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) { nav('/login'); return; }

    fetch(`${API}/stats/insights/${slug}?days=30`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if ([401, 403].includes(r.status)) throw new Error('auth');
        return r.json();
      })
      .then(j => {
        setSummary(j.summary  ?? '');
        setBullets(j.bullets  ?? []);
        setActions(j.actions  ?? []);
      })
      .catch(err => {
        if (err.message === 'auth') nav('/login');
        else setError('Impossibile caricare le analisi');
      })
      .finally(() => setLoading(false));
  }, [slug, nav]);

  /* ---------- UI --------------------------------------------------- */
  if (loading )
    return <p className="insights-loading">Caricamento…</p>;
  if (error)
    return <p className="insights-error">{error}</p>;

  return (
    <div className="insights-page">
      <header className="insights-header">
        <h1>Analisi conversazioni – {slug.toUpperCase()}</h1>
        <Link to={`/dashboard/${slug}`} className="back-link">
          &larr; Torna alla dashboard
        </Link>
      </header>

      {/* ---------- articolo di sintesi --------------------------- */}
      {summary && (
        <article className="insights-summary">
          <h2>Panoramica</h2>
          <p>{summary}</p>
        </article>
      )}

      {/* ---------- griglia insight + azioni --------------------- */}
      <div className="insights-grid">
        <section className="insights-card">
          <h3>Insight principali</h3>
          {bullets.length
            ? (
              <ul>
                {bullets.map(b => (
                  <li key={b}>
                    <span className="dot" /> {b}
                  </li>
                ))}
              </ul>
            )
            : <p>Nessun insight disponibile.</p>
          }
        </section>

        <section className="insights-card">
          <h3>Azioni consigliate</h3>
          {actions.length
            ? (
              <ol>
                {actions.map(a => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            )
            : <p>Nessuna azione consigliata.</p>
          }
        </section>
      </div>
    </div>
  );
}