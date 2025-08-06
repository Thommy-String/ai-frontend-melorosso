// src/pages/PartnerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';

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

const API_BASE = 'https://ai-backend-melorosso.onrender.com';

export default function PartnerDashboard() {
    const { token } = useAuth();
    const [report, setReport] = useState<PartnerReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        const fetchReport = async () => {
            try {
                // ✅ Chiama l'endpoint del report per il mese corrente
                // NOTA: Il tuo endpoint attuale richiede un mese, dovrai adattarlo o crearne uno nuovo
                // per la dashboard (es. /api/partners/dashboard) che restituisca i dati aggregati.
                // Per ora, simuliamo una chiamata a un endpoint ipotetico.
                
                // IPOTETICO ENDPOINT: /api/partners/dashboard
                const res = await fetch(`${API_BASE}/api/partners/dashboard`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Errore nel caricamento dei dati');
                
                const data = await res.json();
                setReport(data);

            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
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