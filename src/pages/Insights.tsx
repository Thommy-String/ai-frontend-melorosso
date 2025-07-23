// src/pages/Insights.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import './Insights.css';

const API = 'https://ai-backend-melorosso.onrender.com';

export default function InsightsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const nav          = useNavigate();

  const [bullets, setBullets]   = useState<string[]>([]);
  const [actions, setActions]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');

  /* -------- fetch ------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token || !slug) { nav('/login'); return; }

    fetch(`${API}/stats/insights/${slug}?days=30`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          throw new Error('auth');
        }
        return r.json();
      })
      .then(j => {
        setBullets(j.bullets ?? []);
        setActions(j.actions ?? []);
      })
      .catch(err => {
        if (err.message === 'auth') nav('/login');
        else setError('Impossibile caricare le analisi');
      })
      .finally(() => setLoading(false));
  }, [slug, nav]);

  /* -------- UI ---------------------------------------------------- */
  if (loading) return <p style={{ padding: 32 }}>Caricamento…</p>;
  if (error)   return <p style={{ padding: 32, color: 'red' }}>{error}</p>;

  return (
    <div className="insights-page">
      <header className="insights-header">
        <h1>Analisi conversazioni – {slug.toUpperCase()}</h1>
        <Link to={`/dashboard/${slug}`}>&larr; Torna alla dashboard</Link>
      </header>

      <section>
        <h2>Insight principali</h2>
        {bullets.length
          ? <ul>{bullets.map(b => <li key={b}>{b}</li>)}</ul>
          : <p>Nessun insight disponibile.</p>}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Azioni consigliate</h2>
        {actions.length
          ? <ol>{actions.map(a => <li key={a}>{a}</li>)}</ol>
          : <p>Nessuna azione consigliata.</p>}
      </section>
    </div>
  );
}