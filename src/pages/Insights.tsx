// src/pages/Insights.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getInsights } from '../api/api';
import './Insights.css';

// --- TIPI ---
interface InsightsData {
  summary: string;
  bullets: string[];
  actions: string[];
}

// --- ICONE ---
const InsightIcon = () => (
  <div className="item-icon-wrapper insight-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5 6 6 0 0 1 6-5 6 6 0 0 1 6 5z" /><path d="M12 1v2" /><path d="M12 21v2" /><path d="m4.22 4.22 1.42 1.42" /><path d="m18.36 18.36 1.42 1.42" /><path d="M1 12h2" /><path d="M21 12h2" /><path d="m4.22 19.78 1.42-1.42" /><path d="m18.36 5.64 1.42-1.42" /></svg>
  </div>
);

const ActionIcon = () => (
  <div className="item-icon-wrapper action-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  </div>
);

// ===================================================================
// COMPONENTE PRINCIPALE
// ===================================================================
export default function InsightsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { token, setToken } = useAuth();

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Se non abbiamo token o slug, non procedere.
    if (!token || !slug) {
      setLoading(false);
      return;
    }

    const loadInsights = async () => {
      try {
        setLoading(true);
        setError('');
        // Usa la funzione API centralizzata passando il token
        const data = await getInsights(slug, token);
        setInsights(data);
      } catch (err) {
        console.error("Errore nel caricamento delle analisi:", err);
        setError("Impossibile caricare le analisi in questo momento.");
        // Se l'errore è di autorizzazione, esegui il logout
        if ((err as Error).message.includes('Unauthorized')) {
          setToken(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [slug, token, setToken]); // L'effetto dipende da slug e token

  // --- Gestione UI per i vari stati ---
  if (loading) {
    return <div className="insights-page page-state-message">Caricamento analisi...</div>;
  }

  if (error) {
    return <div className="insights-page page-state-message error">{error}</div>;
  }

  if (!insights || (!insights.summary && insights.bullets?.length === 0 && insights.actions?.length === 0)) {
    return (
      <div className="insights-page">
        <header className="insights-header">
          <Link to={`/dashboard/${slug}`} className="back-to-dashboard-link">
            ← Torna alla Dashboard
          </Link>
          <h1>Analisi per {slug?.replace(/-/g, ' ')}</h1>
        </header>
        <p className="page-state-message">Nessuna analisi disponibile per il periodo selezionato.</p>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <header className="insights-header">
        <div>
          <h1 className="insights-title">Analisi Conversazioni</h1>
          <p className="insights-subtitle">Riepilogo per {slug?.replace(/-/g, ' ')}</p>
        </div>
        <Link to={`/dashboard/${slug}`} className="back-to-dashboard-link">
          ← Torna alla Dashboard
        </Link>
      </header>

      <main>
        {insights.summary && (
          <section className="summary-section">
            <h2>Panoramica Generale</h2>
            {/* Split per newline per mantenere la formattazione del paragrafo */}
            <p>{insights.summary.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
          </section>
        )}

        <div className="insights-grid">
          <div className="content-card">
            <h3 className="card-title">Punti Chiave Emersi</h3>
            {insights.bullets.length > 0 ? (
              <ul className="item-list">
                {insights.bullets.map((b, i) => (
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
            {/* ✅ CORREZIONE: Usa insights.actions e aggiungi i tipi per 'a' e 'i' */}
            {insights.actions.length > 0 ? (
              <ul className="item-list">
                {insights.actions.map((a: string, i: number) => (
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