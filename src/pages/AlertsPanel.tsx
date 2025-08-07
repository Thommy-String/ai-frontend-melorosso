// src/pages/AlertsPanel.tsx (versione completa e corretta)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminAlerts } from '../api/api';

// ✅ Definiamo i tipi per i dati degli avvisi
interface AlertClient {
  slug: string;
  name: string;
}

interface AlertsState {
  endingSoon: AlertClient[];
  limitReached: AlertClient[];
}

export default function AlertsPanel() {
    const [alerts, setAlerts] = useState<AlertsState | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        getAdminAlerts()
            .then(setAlerts)
            .catch(err => console.error("Errore caricamento avvisi:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="admin-widget"><h3>Caricamento Avvisi...</h3></div>;
    }

    return (
        <div className="alerts-grid">
            <div className="admin-widget">
                <h2>Cicli in Scadenza (7gg)</h2>
                {alerts && alerts.endingSoon.length > 0 ? (
                    <ul className="alert-list">
                        {alerts.endingSoon.map(c => (
                            <li key={c.slug}>
                                <Link to={`/dashboard/${c.slug}`} target="_blank">{c.name}</Link>
                            </li>
                        ))}
                    </ul>
                ) : <p>Nessun ciclo in scadenza.</p>}
            </div>
            <div className="admin-widget">
                <h2>Limite Chat {'>'}80%</h2>
                {alerts && alerts.limitReached.length > 0 ? (
                    <ul className="alert-list">
                        {alerts.limitReached.map(c => (
                            <li key={c.slug}>
                                <Link to={`/dashboard/${c.slug}`} target="_blank">{c.name}</Link>
                            </li>
                        ))}
                    </ul>
                ) : <p>Nessun cliente vicino al limite.</p>}
            </div>
        </div>
    );
}