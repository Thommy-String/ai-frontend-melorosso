// src/pages/PartnerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { getPartnerDashboard } from '../api/api';
import './AdminDashboard.css';

// Definisci i tipi per i dati che riceverai
interface PartnerClient {
    client_name: string;
    client_slug: string;
    plan_name: string;
    commission_earned: string; // È una stringa perché arriva da una SUM di tipo NUMERIC
    start_date: string;
}

interface PartnerReport {
    total_commission: number;
    clients: PartnerClient[];
}



export default function PartnerDashboard() {
    const { token } = useAuth();
    const [report, setReport] = useState<PartnerReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
  if (!token) return;
  const run = async () => {
    try {
      setLoading(true);
      const data = await getPartnerDashboard(token);
      setReport(data);
    } catch (err) {
      setError((err as Error).message || 'Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };
  run();
}, [token]);

    if (loading) return <div>Caricamento...</div>;
    if (error) return <div>Errore: {error}</div>;
    if (!report) return <div>Nessun dato disponibile.</div>;

    return (
        <div>
            <h1>Dashboard Partner</h1>
            <h2>Riepilogo Commissioni</h2>
            <p>Totale Maturato: <strong>€{report.total_commission.toFixed(2)}</strong></p>
            
            <hr />

            <h2>Clienti Associati</h2>
            <table>
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Piano</th>
                        <th>Data Inizio Ciclo</th>
                        <th>Commissione Ciclo</th>
                    </tr>
                </thead>
                <tbody>
                    {report.clients.map(client => (
                        <tr key={client.client_slug}>
                            <td>{client.client_name}</td>
                            <td>{client.plan_name}</td>
                            <td>{new Date(client.start_date).toLocaleDateString('it-IT')}</td>
                            <td>€{parseFloat(client.commission_earned).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
