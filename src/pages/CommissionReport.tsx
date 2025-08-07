// src/pages/CommissionReport.tsx
import React, { useState } from 'react';
import { getCommissionReport } from '../api/api';
import { useAuth } from '../AuthContext';

export default function CommissionReport() {
    const { token } = useAuth();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // "YYYY-MM"

    const handleGenerate = async () => {
        // ✅ 3. Aggiungi un controllo anche qui per sicurezza
        if (!token) {
            alert("Sessione scaduta. Effettua di nuovo il login.");
            return;
        }

        setLoading(true);
        try {
            // ✅ 4. Passa il token alla chiamata API
            const data = await getCommissionReport(month, token);
            setReport(data);
        } catch (error) {
            console.error("Errore report:", error);
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-widget">
            <h2>Report Commissioni Partner</h2>
            <div className="report-controls">
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                <button onClick={handleGenerate} disabled={loading}>
                    {loading ? 'Caricamento...' : 'Genera Report'}
                </button>
            </div>
            {report && (
                <div className="report-results">
                    {Object.keys(report).map(partnerName => (
                        <div key={partnerName} className="partner-report">
                            <h3>{partnerName} - Totale: €{report[partnerName].total_commission.toFixed(2)}</h3>
                            <table className="admin-table">
                                {/* Tabella con i dettagli per cliente... */}
                            </table>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}