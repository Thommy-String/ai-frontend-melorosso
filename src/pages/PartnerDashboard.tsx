// src/pages/PartnerDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { getPartnerDashboard } from '../api/api';
import './AdminDashboard.css';

type PlanBucket = { plan_name: string; count: number };

interface PartnerClient {
    client_name: string;
    client_slug: string;
    plan_name: string;
    commission_earned: string; // numeric come string
    start_date: string;
}

interface PartnerReport {
    total_commission: number;
    totals?: { total_clients: number };
    clients_per_plan?: PlanBucket[];
    clients: PartnerClient[];
    partner_name?: string;      // <-- nuovo
    using_fallback?: boolean;   // <-- nuovo
    partner_commission_rate?: number;
    commission_rate?: number | string; // può arrivare come 0.2 o "20" o "20%"
    commission?: number | string;      // compat vecchie
    partner?: { commission_rate?: number | string; commission?: number | string };
}

/* ---------- util ---------- */
const euro = (n: number) =>
    `€${(isFinite(n) ? n : 0).toFixed(2)}`;

/* metric card riutilizzabile (stile admin) */
const MetricCard = ({ title, value, sub }: { title: string; value: string | number; sub?: string }) => (
    <div className="metric-card-admin">
        <div className="metric-title">{title}</div>
        <div className="metric-value">{value}</div>
        {sub ? <div className="metric-subtext">{sub}</div> : null}
    </div>
);

/* blocco distribuzione piani (stile admin) */
const PlanDistributionCard = ({ buckets }: { buckets: PlanBucket[] | undefined }) => {
    return (
        <div className="metric-card-admin">
            <div className="metric-title">Clienti per Piano</div>
            <div className="plan-distribution">
                {buckets && buckets.length > 0 ? (
                    buckets.map(b => (
                        <div key={b.plan_name} className="plan-row">
                            <span className="plan-name">{b.plan_name}</span>
                            <span className="plan-count">{b.count}</span>
                        </div>
                    ))
                ) : (
                    <p>Nessun cliente in questo periodo.</p>
                )}
            </div>
        </div>
    );
};

export default function PartnerDashboard() {
    const { partnerToken } = useAuth();
    const [report, setReport] = useState<PartnerReport | null>(null);
    const [partnerName, setPartnerName] = useState<string>('');
    const [usingFallback, setUsingFallback] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [error, setErr] = useState('');

    // UI extras
    const [query, setQuery] = useState('');
    // Se vuoi il filtro mensile lato BE, scommenta e usa nel fetch:
    // const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

    const totalClients = report?.totals?.total_clients ?? report?.clients?.length ?? 0;
    const totalCommission = Number(report?.total_commission ?? 0);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return report?.clients ?? [];
        return (report?.clients ?? []).filter((c) =>
            [c.client_name, c.client_slug, c.plan_name]
                .filter(Boolean)
                .some(v => String(v).toLowerCase().includes(q))
        );
    }, [report, query]);

    useEffect(() => {
        if (!partnerToken) return;
        const run = async () => {
            try {
                setLoading(true);
                setErr('');

                const data = await getPartnerDashboard(partnerToken);
                console.log('PartnerDashboard payload:', data, 'keys:', Object.keys(data || {}));
                if (data?.partner_name) setPartnerName(String(data.partner_name));
                setUsingFallback(Boolean(data?.using_fallback)); // <-- aggiungi questa riga
                setReport(data);
            } catch (e: any) {
                setErr(e?.message || 'Errore nel caricamento dei dati');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [partnerToken /*, month*/]);

    if (loading) return <div className="admin-container">Caricamento…</div>;
    if (error) return <div className="admin-container"><p style={{ color: 'crimson' }}>{error}</p></div>;
    if (!report) return <div className="admin-container">Nessun dato disponibile.</div>;

    const avgPerClient = totalClients > 0 ? totalCommission / totalClients : 0;

    // Percentuale commissione: mostra SEMPRE se esiste.
    // Normalizza a formato percentuale umano (0.2 -> 20%, "20" -> 20%, "20%" -> 20%).
    const rateRawCandidate =
      (report as any)?.partner_commission_rate ??
      (report as any)?.commission_rate ??
      (report as any)?.commission ??
      (report as any)?.partner?.commission_rate ??
      (report as any)?.partner?.commission ??
      null;

    const normalizePercent = (val: unknown): string | null => {
      if (val == null) return null;

      let num: number | null = null;

      if (typeof val === 'number') {
        if (!isFinite(val)) return null;
        num = val;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return null;
        const cleaned = trimmed.replace('%', '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (isNaN(parsed)) return null;
        num = parsed;
      } else {
        return null;
      }

      // Se arriva come frazione (0..1) -> moltiplica x100; se >=1 assumiamo già percentuale.
      const percent = num <= 1 ? num * 100 : num;

      // Format: max 2 decimali, senza zeri inutili
      const formatted = percent
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');

      return `${formatted}%`;
    };

    const commissionDisplay: string | null = normalizePercent(rateRawCandidate);

    // Per una barra visiva della commissione vs “nostro lordo” (se vuoi in futuro)
    // qui mostriamo solo il totale commissioni del partner (ha senso per loro)

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>Dashboard Partner{partnerName ? ` · ${partnerName}` : ''}</h1>
            </header>

            {/* KPI */}
            <div className="metrics-grid-admin">
                {usingFallback && totalClients === 0 && (
                    <div className="metric-card-admin">
                        <div className="metric-title">Attenzione</div>
                        <div className="metric-subtext">
                            Nessun abbonamento attivo rilevato per il mese corrente. Stai visualizzando i dati complessivi (fallback).
                        </div>
                    </div>
                )}

                <MetricCard title="Clienti Attivi (Mese Corrente)" value={String(totalClients)} />
                <MetricCard title="Commissioni Maturate" value={euro(totalCommission)} />
                <MetricCard
                    title="Percentuale Commissione"
                    value={commissionDisplay ?? '—'}
                    sub={commissionDisplay ? undefined : 'non disponibile'}
                />
                <MetricCard title="Media Commissione per Cliente" value={euro(avgPerClient)} />
                <PlanDistributionCard buckets={report.clients_per_plan} />
            </div>

            {/* Toolbar filtro/azioni */}
            <div className="widget-toolbar">
                {/* Selettore mese (sblocca quando il BE accetta ?month=YYYY-MM)
        <label className="toolbar-field">
          <span>Mese</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        */}
                <label className="toolbar-field toolbar-grow">
                    <span>Cerca</span>
                    <input
                        type="search"
                        placeholder="Cerca per cliente, slug o piano…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>

                <button
                    className="button-secondary"
                    onClick={() => {
                        // Export CSV semplice
                        const rows = [['Cliente', 'Slug', 'Piano', 'Commissione', 'Inizio ciclo']];
                        (filtered || []).forEach(c => {
                            rows.push([
                                c.client_name,
                                c.client_slug,
                                c.plan_name,
                                parseFloat(c.commission_earned).toFixed(2),
                                new Date(c.start_date).toISOString().slice(0, 10),
                            ]);
                        });
                        const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'partner-clienti.csv'; a.click();
                        URL.revokeObjectURL(url);
                    }}
                >
                    Esporta CSV
                </button>
            </div>

            {/* Tabella clienti */}
            <div className="admin-widget">
                <div className="widget-header">
                    <h2>Clienti Associati</h2>
                </div>
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Piano</th>
                                <th>Data Inizio Ciclo</th>
                                <th>Commissione Ciclo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.client_slug}>
                                    <td data-label="Cliente">
                                        <div className="partner-name">{c.client_name}</div>
                                        <div className="partner-email">{c.client_slug}</div>
                                    </td>
                                    <td data-label="Piano">{c.plan_name}</td>
                                    <td data-label="Inizio">
                                        {new Date(c.start_date).toLocaleDateString('it-IT')}
                                    </td>
                                    <td data-label="Commissione">
                                        {euro(parseFloat(c.commission_earned))}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Nessun risultato per “{query}”.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}