// src/pages/CommissionReport.tsx
import React, { useState } from 'react';
import { format } from 'date-fns';
import { getCommissionReport } from '../api/api';
import { useAuth } from '../AuthContext';

/* ------------------------------------------------------------ */
/* TYPES                                                        */
/* ------------------------------------------------------------ */

interface PartnerRow {
  total_commission: number;
  clients?: {
    slug: string;
    name: string;
    commission: number;
  }[];
}

type Report = Record<string, PartnerRow>;

/* ------------------------------------------------------------ */
/* COMPONENT                                                    */
/* ------------------------------------------------------------ */

export default function CommissionReport() {
  const { token } = useAuth();

  const [month,   setMonth]   = useState(format(new Date(), 'yyyy-MM')); // "YYYY-MM"
  const [report,  setReport]  = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  /* -------------- HANDLERS -------------- */

  const handleGenerate = async () => {
    if (!token) {
      alert('Sessione scaduta – accedi di nuovo.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      alert('Formato mese non valido (YYYY-MM).');
      return;
    }

    setLoading(true);
    try {
      const data = await getCommissionReport(month, token);
      setReport(data);
    } catch (err) {
      console.error('Errore report:', err);
      setReport(null);
      alert('Errore nella generazione del report.');
    } finally {
      setLoading(false);
    }
  };

  /* -------------- RENDER -------------- */

  return (
    <div className="admin-widget">
      <h2>Report Commissioni Partner</h2>

      {/* --- CONTROLS --- */}
      <div className="report-controls">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Caricamento…' : 'Genera Report'}
        </button>
      </div>

      {/* --- RESULTS --- */}
      {report && Object.keys(report).length === 0 && (
        <p>Nessuna commissione per il mese selezionato.</p>
      )}

      {report &&
        Object.entries(report).map(([partnerName, row]) => (
          <div key={partnerName} className="partner-report">
            <h3>
              {partnerName} – Totale:&nbsp;
              <strong>€{row.total_commission.toFixed(2)}</strong>
            </h3>

            {row.clients && row.clients.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Commissione (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {row.clients.map((c) => (
                    <tr key={c.slug}>
                      <td>{c.name}</td>
                      <td>{c.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
    </div>
  );
}