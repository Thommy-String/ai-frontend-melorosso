// src/pages/BillingManager.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { listInvoices, payInvoice, cancelInvoice, getInvoicePayments, refundInvoice, chargebackInvoice } from '../api/api';
type InvoiceStatus = 'issued' | 'paid' | 'cancelled';
type WindowFilter = 'upcoming' | 'overdue' | 'all';

interface InvoiceRow {
    id: string;
    client_slug: string;
    client_name?: string;
    billing_email?: string;
    contact_email?: string;
    invoice_type: 'proforma' | 'invoice';
    status: InvoiceStatus;
    issue_date: string;      // ISO date
    due_date: string;        // ISO date
    period_start: string;    // ISO date
    period_end: string;      // ISO date
    plan_id: string;
    unit_price_net: string;  // numeric in string
    vat_rate: number | string;
    quantity: number;
    subtotal_net: string;    // numeric in string
    vat_amount: string;      // numeric in string
    total_gross: string;     // numeric in string
    reminder_step?: number | null;
    last_reminder_at?: string | null;
    // nuovi campi bilancio
    paid_total?: string;     // "0.00" etc.
    remaining_due?: string;  // "145.18" etc.
}

interface PaymentRow {
    id: string;
    type: 'payment' | 'refund' | 'chargeback';
    amount: string; // numeric as string
    status: string; // 'settled' | 'pending' | etc.
    method?: string;
    reference?: string | null;
    received_at: string; // ISO
    created_at: string;  // ISO
}

const fmtEUR = (n: number | string) =>
    `€${Number(n || 0).toFixed(2)}`;

const fmtDate = (d: string | Date) => {
    const dd = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dd.getTime())) return '-';
    return dd.toLocaleDateString('it-IT');
};

const pct = (num: number, den: number) => {
    if (!den) return 0;
    return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
};
const statusLabel = (inv: InvoiceRow) => {
    const paid = Number(inv.paid_total || 0);
    const due = Number(inv.remaining_due || 0);
    if (inv.status === 'cancelled') return 'Annullata';
    if (inv.status === 'paid') return 'Pagata';
    if (paid > 0 && due > 0) return 'Parz. pagata';
    return 'Emessa';
};

function PayModal({
    invoice,
    onClose,
    onPaid
}: {
    invoice: InvoiceRow | null;
    onClose: () => void;
    onPaid: () => void;
}) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>(() => {
        const due = (invoice as any)?.remaining_due ?? (invoice?.total_gross ?? '0');
        return String(due);
    });
    const [receivedAt, setReceivedAt] = useState<string>(() => {
        const now = new Date();
        // datetime-local vuole yyyy-MM-ddTHH:mm
        const pad = (x: number) => String(x).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });
    const [method, setMethod] = useState<'bank_transfer' | 'other'>('bank_transfer');
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const maxDue = Number((invoice as any)?.remaining_due ?? invoice?.total_gross ?? 0);
    const overMax = Number(amount || 0) > maxDue;

    if (!invoice) return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount || invoice.total_gross), maxDue));
            await payInvoice(invoice.id, {
                amount: amt,
                received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
                method,
                reference: reference || undefined
            }, token);
            onPaid();
            onClose();
        } catch (err: any) {
            alert(err?.message || 'Errore durante il pagamento');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 560 }}>
                <h2>Segna pagata</h2>
                <p style={{ marginTop: 0 }}>
                    Cliente: <b>{invoice.client_name || invoice.client_slug}</b><br />
                    Piano: <b>{invoice.plan_id}</b> — Periodo: <b>{fmtDate(invoice.period_start)} → {fmtDate(invoice.period_end)}</b><br />
                    Totale: <b>{fmtEUR(invoice.total_gross)}</b>
                    {typeof (invoice as any)?.paid_total !== 'undefined' && typeof (invoice as any)?.remaining_due !== 'undefined' && (
                        <>
                          <br />Pagato: <b>{fmtEUR((invoice as any).paid_total)}</b> — Da incassare: <b>{fmtEUR((invoice as any).remaining_due)}</b>
                        </>
                    )}
                </p>

                {overMax && (
                    <div style={{background:'#fff8e1', border:'1px solid #ffe082', color:'#b88000', padding:'6px 10px', borderRadius:6, margin:'8px 0'}}>
                        L'importo supera il residuo ({fmtEUR(maxDue)}). Verrà limitato automaticamente.
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className="form-group">
                        <label>Importo ricevuto</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Data/ora pagamento</label>
                        <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Metodo</label>
                        <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                            <option value="bank_transfer">Bonifico</option>
                            <option value="other">Altro</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Riferimento (CRO/causale)</label>
                        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. CRO123..." />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma pagamento'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function RefundModal({
    invoice,
    onClose,
    onDone
}: {
    invoice: InvoiceRow | null;
    onClose: () => void;
    onDone: () => void;
}) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [receivedAt, setReceivedAt] = useState<string>(() => {
        const now = new Date();
        const pad = (x: number) => String(x).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const maxRefund = Number((invoice as any)?.paid_total ?? 0);
    const overRefund = Number(amount || 0) > maxRefund && maxRefund > 0;

    if (!invoice) return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount || 0), maxRefund || Number(invoice.total_gross || 0)));
            await refundInvoice(invoice.id, {
                amount: amt,
                received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
                method: 'bank_transfer',
                reference: reference || undefined,
            }, token);
            onDone();
            onClose();
        } catch (err: any) {
            alert(err?.message || 'Errore durante il rimborso');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 520 }}>
                <h2>Registra rimborso</h2>

                {overRefund && (
                    <div style={{background:'#fff8e1', border:'1px solid #ffe082', color:'#b88000', padding:'6px 10px', borderRadius:6, margin:'8px 0'}}>
                        Importo oltre il massimo rimborsabile ({fmtEUR(maxRefund)}). Verrà limitato automaticamente.
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className="form-group">
                        <label>Importo</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Data/ora</label>
                        <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Riferimento</label>
                        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. CRO123..." />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ChargebackModal({
    invoice,
    onClose,
    onDone
}: {
    invoice: InvoiceRow | null;
    onClose: () => void;
    onDone: () => void;
}) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [receivedAt, setReceivedAt] = useState<string>(() => {
        const now = new Date();
        const pad = (x: number) => String(x).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const maxCb = Number((invoice as any)?.paid_total ?? 0);
    const overCb = Number(amount || 0) > maxCb && maxCb > 0;

    if (!invoice) return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount || 0), maxCb || Number(invoice.total_gross || 0)));
            await chargebackInvoice(invoice.id, {
                amount: amt,
                received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
                method: 'bank_transfer',
                reference: reference || undefined,
            }, token);
            onDone();
            onClose();
        } catch (err: any) {
            alert(err?.message || 'Errore durante il chargeback');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 520 }}>
                <h2>Registra chargeback</h2>

                {overCb && (
                    <div style={{background:'#fff8e1', border:'1px solid #ffe082', color:'#b88000', padding:'6px 10px', borderRadius:6, margin:'8px 0'}}>
                        Importo oltre il massimo stornabile ({fmtEUR(maxCb)}). Verrà limitato automaticamente.
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className="form-group">
                        <label>Importo</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Data/ora</label>
                        <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Riferimento</label>
                        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. CRO123..." />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function BillingManager() {
    const { token } = useAuth();

    // Loading & errors
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Global search
    const [query, setQuery] = useState<string>('');

    // Datasets per sezione
    const [upcomingRows, setUpcomingRows] = useState<InvoiceRow[]>([]);
    const [overdueRows, setOverdueRows]   = useState<InvoiceRow[]>([]);
    const [paidRows, setPaidRows]         = useState<InvoiceRow[]>([]);

    // Drawer & modals
    const [selected, setSelected] = useState<InvoiceRow | null>(null);
    const [paying, setPaying] = useState<InvoiceRow | null>(null);
    const [showRefund, setShowRefund] = useState<InvoiceRow | null>(null);
    const [showChargeback, setShowChargeback] = useState<InvoiceRow | null>(null);

    // Payments cache for drawer
    const [paymentsMap, setPaymentsMap] = useState<Record<string, PaymentRow[]>>({});

    // Toast
    type ToastMsg = { kind: 'success' | 'error' | 'info'; text: string } | null;
    const [toast, setToast] = useState<ToastMsg>(null);
    const showToast = (text: string, kind: 'success' | 'error' | 'info' = 'success') => {
        setToast({ text, kind });
        window.setTimeout(() => setToast(null), 2500);
    };

    // Helpers
    const num = (x: any) => Number(x || 0);
    const sameDay = (a: Date, b: Date) => {
        const d1 = new Date(a); d1.setHours(0,0,0,0);
        const d2 = new Date(b); d2.setHours(0,0,0,0);
        return d1.getTime() === d2.getTime();
    };
    const isOverdue = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        d.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        return d.getTime() < today.getTime();
    };
    const withinNextDays = (iso: string, days: number) => {
        const d = new Date(iso);
        const today = new Date();
        const limit = new Date();
        d.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        limit.setHours(0,0,0,0);
        limit.setDate(limit.getDate() + days);
        return d.getTime() >= today.getTime() && d.getTime() <= limit.getTime();
    };

    const StatusPill: React.FC<{inv: InvoiceRow}> = ({ inv }) => {
        const label = statusLabel(inv);
        const overdue = isOverdue(inv.due_date);
        const color = inv.status === 'cancelled'
            ? '#666'
            : inv.status === 'paid'
                ? '#0a7d28'
                : overdue
                    ? '#c62828'
                    : '#b88000';
        const bg = inv.status === 'cancelled'
            ? '#f2f2f2'
            : inv.status === 'paid'
                ? '#e6f5ea'
                : overdue
                    ? '#fdecea'
                    : '#fff8e1';
        return (
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, color, background: bg, border: '1px solid rgba(0,0,0,0.06)' }}>
                {label}
            </span>
        );
    };

    // Load all datasets in parallel
    const loadAll = async () => {
        if (!token) return;
        setLoading(true);
        setErr(null);
        try {
            const [up, od, pd] = await Promise.all([
                listInvoices({ status: 'issued',  window: 'upcoming' }, token),
                listInvoices({ status: 'issued',  window: 'overdue'  }, token),
                listInvoices({ status: 'paid',    window: 'all'      }, token),
            ]);
            setUpcomingRows(Array.isArray(up) ? up : []);
            setOverdueRows(Array.isArray(od) ? od : []);
            setPaidRows(Array.isArray(pd) ? pd : []);
        } catch (e: any) {
            setErr(e?.message || 'Errore caricamento fatture');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, [token]);

    const loadPayments = async (invoiceId: string) => {
        if (!token) return;
        try {
            const rows = await getInvoicePayments(invoiceId, token);
            setPaymentsMap(prev => ({ ...prev, [invoiceId]: rows || [] }));
        } catch (e) {
            console.error('load payments error', e);
        }
    };

    // Derived subsets
    const todayRows = useMemo(
        () => upcomingRows.filter(r => sameDay(new Date(r.due_date), new Date())),
        [upcomingRows]
    );
    const next7Rows = useMemo(
        () => upcomingRows.filter(r => !sameDay(new Date(r.due_date), new Date()) && withinNextDays(r.due_date, 7)),
        [upcomingRows]
    );
    const laterRows = useMemo(
        () => upcomingRows.filter(r => !sameDay(new Date(r.due_date), new Date()) && !withinNextDays(r.due_date, 7)),
        [upcomingRows]
    );
    const partialRows = useMemo(
        () => [...upcomingRows, ...overdueRows].filter(r => num(r.paid_total) > 0 && num(r.remaining_due) > 0),
        [upcomingRows, overdueRows]
    );

    // Apply text search to any dataset
    const matchesQuery = (r: InvoiceRow) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const fields = [r.client_name, r.client_slug, r.plan_id, r.invoice_type, r.status];
        return fields.filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    };
    const filterRows = (arr: InvoiceRow[]) => arr.filter(matchesQuery);

    // Totals
    const sum = (arr: InvoiceRow[], key: 'total_gross' | 'paid_total' | 'remaining_due') =>
        arr.reduce((acc, r) => acc + num((r as any)[key]), 0);

    const totals = {
        today:   { count: filterRows(todayRows).length,   due: sum(filterRows(todayRows), 'remaining_due') },
        next7:   { count: filterRows(next7Rows).length,   due: sum(filterRows(next7Rows), 'remaining_due') },
        later:   { count: filterRows(laterRows).length,   due: sum(filterRows(laterRows), 'remaining_due') },
        overdue: { count: filterRows(overdueRows).length, due: sum(filterRows(overdueRows), 'remaining_due') },
        paid30:  (() => {
            const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
            const recent = paidRows.filter(r => {
                const dt = new Date(r.issue_date || r.due_date);
                return dt.getTime() >= thirtyAgo.getTime();
            });
            return { count: filterRows(recent).length, total: sum(filterRows(recent), 'total_gross') };
        })()
    };

    // CSV export
    const exportToCSV = () => {
        const headers = ['id','client_slug','client_name','invoice_type','status','issue_date','due_date','period_start','period_end','plan_id','total_gross','paid_total','remaining_due'];
        const all = [...upcomingRows, ...overdueRows, ...paidRows].filter(matchesQuery);
        const lines = [
            headers.join(','),
            ...all.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))
        ];
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Row renderer for compact table
    const Row = ({inv}: {inv: InvoiceRow}) => (
        <tr>
            <td>{inv.client_name || inv.client_slug}</td>
            <td>
                {inv.plan_id}
                {inv.invoice_type === 'proforma' && (
                    <span style={{ marginLeft: 6, fontSize: 12, padding: '2px 6px', borderRadius: 6, background: '#eef2ff', color: '#3f51b5' }}>
                        Proforma
                    </span>
                )}
            </td>
            <td>{fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</td>
            <td>{fmtDate(inv.due_date)}{isOverdue(inv.due_date) ? ' • scad.' : ''}</td>
            <td>
                {fmtEUR(inv.paid_total || 0)} / {fmtEUR(inv.total_gross)}
                <div style={{ height: 6, background: '#eee', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct(num(inv.paid_total || 0), num(inv.total_gross || 0))}%`, height: '100%', background: '#0a7d28' }} />
                </div>
            </td>
            <td>{fmtEUR(inv.remaining_due || 0)}</td>
            <td><StatusPill inv={inv} /></td>
            <td>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {inv.status !== 'cancelled' && num(inv.remaining_due) > 0 && (
                        <button className="button-primary" onClick={() => setPaying(inv)}>Incassa</button>
                    )}
                    <button className="button-secondary" onClick={() => { setSelected(inv); loadPayments(inv.id); }}>Dettagli</button>
                    {inv.status === 'issued' && num(inv.paid_total) === 0 && (
                        <button className="button-secondary" onClick={async () => {
                            if (!token) return;
                            if (!confirm('Confermi annullamento?')) return;
                            try { await cancelInvoice(inv.id, token); await loadAll(); }
                            catch (e: any) { alert(e?.message || 'Errore durante annullamento'); }
                        }}>Annulla</button>
                    )}
                </div>
            </td>
        </tr>
    );

    // Section block
    const Section = ({
        title, hint, rows
    }: { title: string; hint?: React.ReactNode; rows: InvoiceRow[] }) => (
        <div className="admin-widget" style={{ marginTop: '1rem' }}>
            <div className="widget-header">
                <h3 style={{ margin: 0 }}>{title}</h3>
                {hint ? <div className="widget-toolbar">{hint}</div> : null}
            </div>
            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Piano</th>
                            <th>Periodo</th>
                            <th>Scadenza</th>
                            <th>Pagato / Totale</th>
                            <th>Residuo</th>
                            <th>Stato</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length ? rows.map(r => <Row key={r.id} inv={r} />) : (
                            <tr><td colSpan={8}>Nessuna voce.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Drawer laterale con ledger pagamenti
    const Drawer = ({ inv, onClose }: { inv: InvoiceRow | null; onClose: () => void }) => {
        if (!inv) return null;
        const pmts = paymentsMap[inv.id] || [];
        return (
            <div style={{
                position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px',
                background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.15)', zIndex: 50, overflowY: 'auto'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{inv.client_name || inv.client_slug}</h3>
                    <button className="button-secondary" onClick={onClose}>Chiudi</button>
                </div>
                <div style={{ padding: 16 }}>
                    <p style={{ marginTop: 0 }}>
                        Piano: <b>{inv.plan_id}</b><br />
                        Periodo: <b>{fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</b><br />
                        Scadenza: <b>{fmtDate(inv.due_date)}{isOverdue(inv.due_date) ? ' (scaduta)' : ''}</b><br />
                        Totale: <b>{fmtEUR(inv.total_gross)}</b> — Pagato: <b>{fmtEUR(inv.paid_total || 0)}</b> — Residuo: <b>{fmtEUR(inv.remaining_due || 0)}</b>
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {num(inv.remaining_due) > 0 && <button className="button-primary" onClick={() => setPaying(inv)}>Incassa</button>}
                        {num(inv.paid_total) > 0 && (
                            <>
                                <button className="button-secondary" onClick={() => setShowRefund(inv)}>Rimborso</button>
                                <button className="button-secondary" onClick={() => setShowChargeback(inv)}>Chargeback</button>
                            </>
                        )}
                        {inv.status === 'issued' && num(inv.paid_total) === 0 && (
                            <button className="button-secondary" onClick={async () => {
                                if (!token) return;
                                if (!confirm('Confermi annullamento?')) return;
                                try { await cancelInvoice(inv.id, token); await loadAll(); onClose(); }
                                catch (e: any) { alert(e?.message || 'Errore durante annullamento'); }
                            }}>Annulla</button>
                        )}
                    </div>

                    <h4 style={{ margin: '8px 0' }}>Movimenti</h4>
                    {pmts.length === 0 ? (
                        <p style={{ color: '#666' }}>Nessun movimento.</p>
                    ) : (
                        <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                            {pmts.map(p => (
                                <li key={p.id} style={{ marginBottom: 6 }}>
                                    <b>{p.type}</b> — {fmtEUR(p.amount)} — {new Date(p.received_at).toLocaleString('it-IT')}
                                    {p.reference ? <> — ref: <code>{p.reference}</code></> : null}
                                    {p.status !== 'settled' ? <> — stato: {p.status}</> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    };

    // Render
    return (
        <div className="admin-widget" style={{ border: 'none', padding: 0 }}>
            <div className="widget-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 5 }}>
                <h2>Fatture</h2>
                <div className="widget-toolbar">
                    <input type="search" placeholder="Cerca..." value={query} onChange={(e) => setQuery(e.target.value)} />
                    <button className="button-secondary" onClick={loadAll}>Aggiorna</button>
                    <button className="button-secondary" onClick={exportToCSV}>Export CSV</button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div className="metric-card-admin"><div className="metric-title">Oggi</div><div className="metric-value">{totals.today.count}</div><div className="metric-subtext">Residuo {fmtEUR(totals.today.due)}</div></div>
                <div className="metric-card-admin"><div className="metric-title">Prossimi 7 giorni</div><div className="metric-value">{totals.next7.count}</div><div className="metric-subtext">Residuo {fmtEUR(totals.next7.due)}</div></div>
                <div className="metric-card-admin"><div className="metric-title">Più avanti</div><div className="metric-value">{totals.later.count}</div><div className="metric-subtext">Residuo {fmtEUR(totals.later.due)}</div></div>
                <div className="metric-card-admin"><div className="metric-title">Scadute</div><div className="metric-value">{totals.overdue.count}</div><div className="metric-subtext">Residuo {fmtEUR(totals.overdue.due)}</div></div>
                <div className="metric-card-admin"><div className="metric-title">Pagate (30gg)</div><div className="metric-value">{totals.paid30.count}</div><div className="metric-subtext">Tot. {fmtEUR(totals.paid30.total)}</div></div>
            </div>

            {loading && <p>Caricamento…</p>}
            {err && <p style={{ color: 'crimson' }}>{err}</p>}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <Section
                        title={`Oggi (${filterRows(todayRows).length})`}
                        hint={<span>Residuo: <b>{fmtEUR(totals.today.due)}</b></span>}
                        rows={filterRows(todayRows)}
                    />

                    <Section
                        title={`In Scadenza (7gg) (${filterRows(next7Rows).length})`}
                        hint={<span>Residuo: <b>{fmtEUR(totals.next7.due)}</b></span>}
                        rows={filterRows(next7Rows)}
                    />

                    <Section
                        title={`Più Avanti (${filterRows(laterRows).length})`}
                        hint={<span>Residuo: <b>{fmtEUR(totals.later.due)}</b></span>}
                        rows={filterRows(laterRows)}
                    />

                    <Section
                        title={`Scadute (${filterRows(overdueRows).length})`}
                        hint={<span>Residuo: <b>{fmtEUR(totals.overdue.due)}</b></span>}
                        rows={filterRows(overdueRows)}
                    />

                    {/* Storico: ultime 60 giorni (pagate) */}
                    {(() => {
                        const sixtyAgo = new Date(); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
                        const hist = filterRows(paidRows).filter(r => new Date(r.issue_date || r.due_date) >= sixtyAgo);
                        const total = sum(hist, 'total_gross');
                        return (
                            <Section
                                title={`Storico (ultimi 60gg) — ${hist.length} pagate`}
                                hint={<span>Totale: <b>{fmtEUR(total)}</b></span>}
                                rows={hist}
                            />
                        );
                    })()}
                </div>
            )}

            {/* Drawer Dettagli */}
            <Drawer inv={selected} onClose={() => setSelected(null)} />

            {/* Modals */}
            <PayModal
                invoice={paying}
                onClose={() => setPaying(null)}
                onPaid={() => { loadAll(); if (selected) loadPayments(selected.id); showToast('Pagamento registrato'); }}
            />
            <RefundModal
                invoice={showRefund}
                onClose={() => setShowRefund(null)}
                onDone={() => { loadAll(); if (selected) loadPayments(selected.id); showToast('Rimborso registrato'); }}
            />
            <ChargebackModal
                invoice={showChargeback}
                onClose={() => setShowChargeback(null)}
                onDone={() => { loadAll(); if (selected) loadPayments(selected.id); showToast('Chargeback registrato'); }}
            />

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: 12,
                    right: 12,
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: toast.kind === 'error' ? '#fdecea' : (toast.kind === 'info' ? '#e8f4fd' : '#e6f5ea'),
                    color: toast.kind === 'error' ? '#c62828' : (toast.kind === 'info' ? '#1565c0' : '#0a7d28'),
                    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                    zIndex: 1000
                }}>
                    {toast.text}
                </div>
            )}
        </div>
    );
}