import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = 'https://ai-backend-melorosso.onrender.com';

export default function InsightsPage () {
  const { slug } = useParams<{ slug: string }>();
  const [bullets, setBullets] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    const tok = localStorage.getItem('jwt');
    if (!tok || !slug) return;
    fetch(`${API}/stats/insights/${slug}?days=30`, {
      headers: { Authorization: `Bearer ${tok}` }
    })
    .then(r => r.json())
    .then(j => {
      setBullets(j.bullets || []);
      setActions(j.actions || []);
    });
  }, [slug]);

  return (
    <div className="insights-page">
      <h1>Analisi conversazioni – {slug?.toUpperCase()}</h1>

      <section>
        <h2>Insight principali</h2>
        <ul>{bullets.map(b => <li key={b}>{b}</li>)}</ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Prossime azioni consigliate</h2>
        <ol>{actions.map(a => <li key={a}>{a}</li>)}</ol>
      </section>
    </div>
  );
}