import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { getPartnerDashboard } from '../api/api';
import './AdminDashboard.css';

/* =========================
 * Tipi
 * ========================= */
interface PotentialInvoice {
  invoice_id: string;
  client_slug: string;
  client_name: string;
  plan_name: string;
  issue_date: string;
  invoice_status: string;
  total_gross: string | number;
  commission_potential: string | number;
}
interface EarnedInvoice {
  invoice_id: string;
  client_slug: string;
  client_name: string;
  plan_name: string;
  paid_at: string;
  original_issue_date: string;
  commission_earned: string | number;
}
interface ClientRow {
  client_name: string;
  plan_name: string;
  start_date: string; // ISO
}
interface PartnerReport {
  partner_name?: string;
  partner_commission_rate?: number;
  clients: ClientRow[];
  earned_invoices: EarnedInvoice[];
  potential_invoices: PotentialInvoice[];
}

/* =========================
 * Helpers UI
 * ========================= */
const EUR_FMT = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const euro = (n: number | string | undefined | null) => EUR_FMT.format(Number.isFinite(Number(n)) ? Number(n) : 0);

// Month helpers
const toMonthString = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};
const parseMonthSafe = (s: string): Date | null => {
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(Date.UTC(y, m - 1, 1));
};
const shiftMonth = (s: string, delta: number): string => {
  const base = parseMonthSafe(s) ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  base.setUTCMonth(base.getUTCMonth() + delta);
  return toMonthString(base);
};

/** Genera una lista di mesi (in discesa) per il selettore */
const recentMonthOptions = (count: number = 18) => {
  const base = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    const value = toMonthString(d);
    const label = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 2)).toLocaleString('it-IT', {
      month: 'long',
      year: 'numeric'
    });
    out.push({ value, label });
  }
  return out;
};

// CSV helpers
const buildCsv = (headers: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\n');
};
const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
};

// Calcola la data di pagamento commissioni: 15 del mese successivo
const payoutDateForMonth = (monthStr: string): string => {
  try {
    const [y, m] = monthStr.split('-').map(Number);
    if (!y || !m) return '—';
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(15);
    return d.toLocaleDateString('it-IT');
  } catch {
    return '—';
  }
};

// Calcola il 15 del mese successivo rispetto a una data di pagamento fattura
const payoutDateFromPaidAt = (iso: string | undefined | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  d.setMonth(d.getMonth() + 1);
  d.setDate(15);
  return d.toLocaleDateString('it-IT');
};

const MetricCard = ({
  title,
  value,
  sub,
  large = false,
  accent = '#e5e7eb',
  icon
}: {
  title: string;
  value: string | number;
  sub?: React.ReactNode;
  large?: boolean;
  accent?: string;
  icon?: React.ReactNode;
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: large ? '1.25rem 1.25rem' : '0.9rem 1rem',
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #eee',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    position: 'relative'
  };
  const leftBar: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: '100%',
    background: accent,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#666',
    fontSize: 13,
    fontWeight: 500
  };
  const valueStyle: React.CSSProperties = {
    fontSize: large ? 32 : 24,
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.02em'
  };
  const subStyle: React.CSSProperties = {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13
  };
  const iconWrap: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: `${accent}22`
  };

  return (
    <div className={`metric-card-admin ${large ? 'large' : ''}`} style={baseStyle}>
      <div style={leftBar} aria-hidden />
      <div style={headerStyle}>
        {icon ? <span style={iconWrap}>{icon}</span> : null}
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-value" style={valueStyle}>{value}</div>
      {sub ? <div className="metric-subtext" style={subStyle}>{sub}</div> : null}
    </div>
  );
};

/* =========================
 * Dashboard Partner – semplificata e chiara
 * ========================= */
export default function PartnerDashboard() {
  const { partnerToken } = useAuth();
  const [month, setMonth] = useState(() => {
    const todayUTC = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    return toMonthString(todayUTC);
  });
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState('');
  const [data, setData] = useState<PartnerReport | null>(null);

  const monthOptions = useMemo(() => recentMonthOptions(18), []);

  // Refresh/data controls
  const [refreshTick, setRefreshTick] = useState(0);
  const refetch = () => setRefreshTick(t => t + 1);
  const prevMonth = () => setMonth(m => shiftMonth(m, -1));
  const nextMonth = () => setMonth(m => shiftMonth(m, +1));

  useEffect(() => {
    if (!partnerToken) { setLoading(false); return; }
    let aborted = false;
    (async () => {
      try {
        setLoading(true); setErr('');
        const raw = await getPartnerDashboard(partnerToken, month);
        const potential: PotentialInvoice[] = raw?.data?.potential_invoices ?? [];
        const earned: EarnedInvoice[] = raw?.data?.earned_invoices ?? [];
        const clientMap = new Map<string, ClientRow>();
        const updateClient = (slug: string, name: string, plan: string, startISO?: string) => {
          const prev = clientMap.get(slug);
          const prevStart = prev?.start_date ? new Date(prev.start_date).getTime() : Number.POSITIVE_INFINITY;
          const nextStart = startISO ? new Date(startISO).getTime() : Number.POSITIVE_INFINITY;
          let chosenStart = prev?.start_date || '';
          if (Number.isFinite(nextStart) && nextStart < prevStart) chosenStart = startISO!;
          clientMap.set(slug, { client_name: name, plan_name: plan, start_date: chosenStart });
        };
        potential.forEach(p => updateClient(String(p.client_slug), p.client_name, p.plan_name, p.issue_date));
        earned.forEach(e => updateClient(String(e.client_slug), e.client_name, e.plan_name, e.original_issue_date));
        const clients = Array.from(clientMap.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
        if (!aborted) {
          setData({ partner_name: raw?.partner_name, partner_commission_rate: raw?.partner_commission_rate, clients, earned_invoices: earned, potential_invoices: potential });
        }
      } catch (e: any) {
        if (!aborted) setErr(e?.message || 'Errore di caricamento');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [partnerToken, month, refreshTick]);

  useEffect(() => {
    // normalize month format if user agent provides a different string
    if (!/^\d{4}-\d{2}$/.test(month)) {
      const parsed = parseMonthSafe(month);
      if (parsed) setMonth(toMonthString(parsed));
      else setMonth(toMonthString(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))));
    }
  }, [month]);

  /* ======= Derivazioni chiare per le KPI ======= */
  const monthLabel = useMemo(() => {
    try {
      return new Date(`${month}-02`).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    } catch {
      return month;
    }
  }, [month]);

  const totalClients = useMemo(() => data?.clients?.length ?? 0, [data]);

  const commissionRateDisplay = useMemo(() => {
    if (data?.partner_commission_rate == null) return 'N/D';
    return `${(Number(data.partner_commission_rate) * 100).toFixed(0)}%`;
  }, [data?.partner_commission_rate]);

  const earnedThisMonth = useMemo(() => {
    if (!data?.earned_invoices) return 0;
    return data.earned_invoices.reduce((acc, r) => acc + Number(r.commission_earned ?? 0), 0);
  }, [data?.earned_invoices]);

  const earnedIds = useMemo(() => new Set((data?.earned_invoices ?? []).map(e => String(e.invoice_id))), [data?.earned_invoices]);

  const unpaidInvoices = useMemo(() => {
    const all = data?.potential_invoices ?? [];
    return all.filter(p => !earnedIds.has(String(p.invoice_id)));
  }, [data?.potential_invoices, earnedIds]);

  const unpaidCommission = useMemo(
    () => unpaidInvoices.reduce((acc, r) => acc + Number(r.commission_potential ?? 0), 0),
    [unpaidInvoices]
  );

  // Payout previsto = quanto hai maturato nel mese selezionato (verrà pagato secondo il vostro ciclo)
  const payoutPlanned = earnedThisMonth;
  const payoutDateLabel = useMemo(() => payoutDateForMonth(month), [month]);

  /* ======= UI ======= */
  if (loading) return <div className="admin-container">Caricamento…</div>;
  if (error) return <div className="admin-container"><p style={{ color: 'crimson' }}>{error}</p></div>;
  if (!data) return <div className="admin-container">Nessun dato disponibile.</div>;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Dashboard Partner{data.partner_name ? ` · ${data.partner_name}` : ''}</h1>
        <div className="widget-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#666' }}>Mese:</span>
          <button aria-label="Mese precedente" onClick={prevMonth} title="Mese precedente" style={{ padding: '4px 8px' }}>◀︎</button>
          <select
            aria-label="Seleziona mese"
            value={month}
            onChange={(e) => {
              const v = e.target.value;
              const parsed = parseMonthSafe(v);
              setMonth(parsed ? toMonthString(parsed) : v);
            }}
            style={{ padding: '6px 8px' }}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button aria-label="Mese successivo" onClick={nextMonth} title="Mese successivo" style={{ padding: '4px 8px' }}>▶︎</button>
          <button onClick={refetch} className="button-secondary" title="Ricarica dati">Aggiorna</button>
          {typeof data?.partner_commission_rate === 'number' && (
            <span style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontSize: 12 }}>
              Commissione: <b>{(data.partner_commission_rate * 100).toFixed(0)}%</b>
            </span>
          )}
          <strong style={{ marginLeft: 4 }}>{monthLabel}</strong>
        </div>
      </header>

      {/* KPI primarie: cosa ho, quanto prendo, che cosa è maturato e cosa è ancora in sospeso */}
      <div className="metrics-grid-admin single-large">
        <MetricCard
          large
          title={`Commissione guadagnata (${monthLabel})`}
          value={euro(payoutPlanned)}
          sub={<span>Li riceverai il <b>{payoutDateLabel}</b></span>}
          accent="#0a7d28"
          icon={<span role="img" aria-label="euro">💶</span>}
        />

        <div className="small-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <MetricCard
            title="Clienti"
            value={totalClients}
            accent="#2563eb"
            icon={<span role="img" aria-label="clienti">👥</span>}
            sub={<span style={{ fontSize: 12 }}>Totale clienti che hai portato</span>}
          />
          <MetricCard
            title="La tua commissione"
            value={commissionRateDisplay}
            accent="#7c3aed"
            icon={<span role="img" aria-label="percentuale">📈</span>}
            sub={<span style={{ fontSize: 12 }}>per ogni cliente</span>}
          />
          <MetricCard
            title={`Maturato in ${monthLabel}`}
            value={euro(earnedThisMonth)}
            accent="#059669"
            icon={<span role="img" aria-label="maturato">✅</span>}
            sub={<span style={{ fontSize: 12 }}>Clienti attivi che hanno pagato</span>}
          />
          <MetricCard
            title="In attesa"
            value={euro(unpaidCommission)}
            accent="#f59e0b"
            icon={<span role="img" aria-label="in attesa">⏳</span>}
            sub={<span style={{ fontSize: 12 }}>Clienti attivi che non hanno ancora pagato</span>}
          />
        </div>
      </div>

      {/* Clienti */}
      <div className="admin-widget" style={{ marginTop: '2rem' }}>
        <div className="widget-header"><h2>Clienti</h2></div>
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Piano</th>
                <th>Iniziato il</th>
              </tr>
            </thead>
            <tbody>
              {data.clients && data.clients.length > 0 ? (
                data.clients.map((c, idx) => (
                  <tr key={`${c.client_name}-${idx}`}>
                    <td>{c.client_name}</td>
                    <td>{c.plan_name}</td>
                    <td>{c.start_date ? new Date(c.start_date).toLocaleDateString('it-IT') : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.25rem' }}>Nessun cliente assegnato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non pagate (chiare e sintetiche) */}
      <div className="admin-widget" style={{ marginTop: '2rem' }}>
        <div className="widget-header"><h2>Clienti non pagatori di {monthLabel}</h2></div>
        <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="button-secondary" onClick={() => {
            const headers = ['Cliente','Piano','Data emissione','Commissione potenziale','Stato'];
            const rows = unpaidInvoices.map(inv => [
              inv.client_name,
              inv.plan_name,
              inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('it-IT') : '-',
              euro(inv.commission_potential),
              inv.invoice_status || 'emessa'
            ]);
            downloadCsv(`non-pagatori-${month}.csv`, buildCsv(headers, rows));
          }}>Esporta CSV</button>
        </div>
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Piano</th>
                <th>Data emissione</th>
                <th>Commissione potenziale</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {unpaidInvoices.length > 0 ? (
                unpaidInvoices.map((inv, idx) => (
                  <tr key={`${inv.invoice_id}-${idx}`}>
                    <td>{inv.client_name}</td>
                    <td>{inv.plan_name}</td>
                    <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('it-IT') : '-'}</td>
                    <td>{euro(inv.commission_potential)}</td>
                    <td>{inv.invoice_status || 'emessa'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: '#0a7d28' }}>Tutti i clienti di {monthLabel} hanno pagato ✅</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}></td>
                <td><b>{euro(unpaidCommission)}</b></td>
                <td style={{ color: '#6b7280' }}>Totale</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pagate nel mese */}
      <div className="admin-widget" style={{ marginTop: '2rem' }}>
        <div className="widget-header"><h2>Fatture pagate in {monthLabel}</h2></div>
        <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="button-secondary" onClick={() => {
            const headers = ['Cliente','Piano','Data pagamento','Riceverai la commissione','Commissione maturata'];
            const rows = (data?.earned_invoices ?? []).map(inv => [
              inv.client_name,
              inv.plan_name,
              inv.paid_at ? new Date(inv.paid_at).toLocaleString('it-IT') : '-',
              payoutDateFromPaidAt(inv.paid_at),
              euro(inv.commission_earned)
            ]);
            downloadCsv(`pagate-${month}.csv`, buildCsv(headers, rows));
          }}>Esporta CSV</button>
        </div>
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Piano</th>
                <th>Data pagamento</th>
                <th>Riceverai la commissione il</th>
                <th>Commissione maturata</th>
              </tr>
            </thead>
            <tbody>
              {data.earned_invoices && data.earned_invoices.length > 0 ? (
                data.earned_invoices.map((inv, idx) => (
                  <tr key={`${inv.invoice_id}-${idx}`}>
                    <td>{inv.client_name}</td>
                    <td>{inv.plan_name}</td>
                    <td>{inv.paid_at ? new Date(inv.paid_at).toLocaleString('it-IT') : '-'}</td>
                    <td>{payoutDateFromPaidAt(inv.paid_at)}</td>
                    <td>{euro(inv.commission_earned)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem' }}>Nessuna fattura pagata nel mese selezionato.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}></td>
                <td><b>{euro(earnedThisMonth)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}