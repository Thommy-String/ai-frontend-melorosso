import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { listInvoices, payInvoice, cancelInvoice, getInvoicePayments, refundInvoice, chargebackInvoice } from '../api/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- TYPES & INTERFACES ---
type InvoiceStatus = 'issued' | 'paid' | 'cancelled';
type SubscriptionStatus = 'active' | 'suspended' | 'past_due' | null;

interface InvoiceRow {
    id: string;
    client_slug: string;
    client_name?: string;
    invoice_type: 'proforma' | 'invoice';
    status: InvoiceStatus;
    issue_date: string;
    due_date: string;
    period_start: string;
    period_end: string;
    plan_id: string;
    total_gross: string;
    paid_at?: string | null;
    paid_total?: string;
    remaining_due?: string;
    subscription_status?: SubscriptionStatus;
    reminder_step?: number | null; // Corrected to allow null
}

interface PaymentRow {
    id: string;
    type: 'payment' | 'refund' | 'chargeback';
    amount: string;
    status: string;
    method?: string;
    reference?: string | null;
    received_at: string;
    created_at: string;
}

// --- GLOBAL HELPER FUNCTIONS ---
const fmtEUR = (n: number | string) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const pct = (num: number, den: number) => {
    if (!den || den === 0) return 0;
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
const sameDay = (a: Date, b: Date) => {
    const d1 = new Date(a); d1.setHours(0,0,0,0);
    const d2 = new Date(b); d2.setHours(0,0,0,0);
    return d1.getTime() === d2.getTime();
};

function PayModal({ invoice, onClose, onPaid }: { invoice: InvoiceRow | null; onClose: () => void; onPaid: () => void; }) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [receivedAt, setReceivedAt] = useState<string>('');
    const [method, setMethod] = useState<'bank_transfer' | 'other'>('bank_transfer');
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (invoice) {
            const due = invoice.remaining_due ?? invoice.total_gross ?? '0';
            setAmount(String(due));
            const now = new Date();
            const pad = (x: number) => String(x).padStart(2, '0');
            setReceivedAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
            setReference('');
        }
    }, [invoice]);

    if (!invoice) return null;
    const maxDue = Number(invoice.remaining_due ?? invoice.total_gross ?? 0);
    const overMax = Number(amount || 0) > maxDue;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount), maxDue));
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
                    Totale: <b>{fmtEUR(invoice.total_gross)}</b><br/>
                    Da incassare: <b>{fmtEUR(invoice.remaining_due || 0)}</b>
                </p>
                {overMax && <div style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#b88000', padding: '6px 10px', borderRadius: 6, margin: '8px 0' }}>L'importo supera il residuo ({fmtEUR(maxDue)}). Verrà limitato.</div>}
                <form onSubmit={submit}>
                    <div className="form-group"><label>Importo ricevuto</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                    <div className="form-group"><label>Data/ora pagamento</label><input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required /></div>
                    <div className="form-group"><label>Metodo</label><select value={method} onChange={(e) => setMethod(e.target.value as any)}><option value="bank_transfer">Bonifico</option><option value="other">Altro</option></select></div>
                    <div className="form-group"><label>Riferimento</label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. CRO123..." /></div>
                    <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma'}</button></div>
                </form>
            </div>
        </div>
    );
}

function RefundModal({ invoice, onClose, onDone }: { invoice: InvoiceRow | null; onClose: () => void; onDone: () => void; }) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if(invoice) {
            setAmount(invoice.paid_total || '0');
            setReference('');
        }
    }, [invoice]);

    if (!invoice) return null;
    const maxRefund = Number(invoice.paid_total ?? 0);
    const overRefund = Number(amount || 0) > maxRefund && maxRefund > 0;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount || 0), maxRefund));
            await refundInvoice(invoice.id, { amount: amt, reference: reference || undefined }, token);
            onDone();
            onClose();
        } catch (err: any) {
            alert(err?.message || 'Errore durante il rimborso');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 520 }}>
            <h2>Registra rimborso</h2>
            {overRefund && <div style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#b88000', padding: '6px 10px', borderRadius: 6, margin: '8px 0' }}>Importo oltre il massimo rimborsabile ({fmtEUR(maxRefund)}). Verrà limitato.</div>}
            <form onSubmit={submit}>
                <div className="form-group"><label>Importo da rimborsare</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder={fmtEUR(maxRefund)} /></div>
                <div className="form-group"><label>Riferimento</label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. storno per cliente" /></div>
                <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma'}</button></div>
            </form>
        </div></div>
    );
}


function ChargebackModal({ invoice, onClose, onDone }: { invoice: InvoiceRow | null; onClose: () => void; onDone: () => void; }) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);
    
    useEffect(() => {
        if(invoice) {
            setAmount(invoice.paid_total || '0');
            setReference('');
        }
    }, [invoice]);

    if (!invoice) return null;
    const maxCb = Number(invoice.paid_total ?? 0);
    const overCb = Number(amount || 0) > maxCb && maxCb > 0;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !invoice) return;
        try {
            setBusy(true);
            const amt = Math.max(0, Math.min(Number(amount || 0), maxCb));
            await chargebackInvoice(invoice.id, { amount: amt, reference: reference || undefined }, token);
            onDone();
            onClose();
        } catch (err: any) {
            alert(err?.message || 'Errore durante il chargeback');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 520 }}>
            <h2>Registra chargeback</h2>
            {overCb && <div style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#b88000', padding: '6px 10px', borderRadius: 6, margin: '8px 0' }}>Importo oltre il massimo stornabile ({fmtEUR(maxCb)}). Verrà limitato.</div>}
            <form onSubmit={submit}>
                <div className="form-group"><label>Importo stornato</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder={fmtEUR(maxCb)} /></div>
                <div className="form-group"><label>Riferimento</label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="es. Stripe ID xxx" /></div>
                <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Attendere…' : 'Conferma'}</button></div>
            </form>
        </div></div>
    );
}
// =========== MAIN BILLING MANAGER COMPONENT (ENHANCED) ===========
export default function BillingManager() {
    const { token } = useAuth();
    const [avoidDouble, setAvoidDouble] = useState(true);
    // Helper to generate proformas for the next N days via admin endpoint
    const generateProformasNext = async (days = 30) => {
        if (!token) return { inserted: 0 } as any;
        const res = await fetch('/api/admin/billing/cron/generate-proformas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ window_days: days }),
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(t || 'Errore generazione proforme');
        }
        return res.json();
    };

    type FilterType = 'upcoming' | 'overdue' | 'paid_recent' | 'all' | 'future';
    const [activeFilter, setActiveFilter] = useState<FilterType>('upcoming');
    // Dataset completo (usato per contatori e viste); non ricarichiamo quando cambia filtro
    const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [query, setQuery] = useState<string>('');

    const [selected, setSelected] = useState<InvoiceRow | null>(null);
    const [paying, setPaying] = useState<InvoiceRow | null>(null);
    const [showRefund, setShowRefund] = useState<InvoiceRow | null>(null);
    const [showChargeback, setShowChargeback] = useState<InvoiceRow | null>(null);
    const [paymentsMap, setPaymentsMap] = useState<Record<string, PaymentRow[]>>({});

    type ToastMsg = { kind: 'success' | 'error' | 'info'; text: string } | null;
    const [toast, setToast] = useState<ToastMsg>(null);
    const showToast = (text: string, kind: 'success' | 'error' | 'info' = 'success') => {
        setToast({ text, kind });
        window.setTimeout(() => setToast(null), 3000);
    };

    const loadInvoices = async () => {
        if (!token) return;
        setLoading(true);
        setErr(null);
        try {
            // Carichiamo sempre il perimetro più ampio; poi filtriamo client-side per le viste
            const apiResult = await listInvoices({ status: 'all', window: 'all' }, token);
            setAllInvoices(apiResult ?? []);
        } catch (e: any) {
            setErr(e?.message || 'Error loading invoices');
            setAllInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadInvoices(); }, [token]);
    const refreshCurrentView = () => loadInvoices();
    const loadPayments = async (invoiceId: string) => {
        if (!token) return;
        try {
            const rows = (await getInvoicePayments(invoiceId, token)) ?? [];
            setPaymentsMap(prev => ({ ...prev, [invoiceId]: rows }));
        } catch (e) {
            console.error('load payments error', e);
        }
    };
    const {
        overdueRows,
        todayRows,
        thisWeekRows,
        thisMonthRows,
        futureRows,
        forecastData,
        paidRecentRows,
        futureAllRows,
        allRows,
        upcomingCount,
        futureCount,
        overdueCount,
        paidRecentCount,
        allCount,
    } = useMemo(() => {
        // 1) Opzionale: evita doppia visualizzazione (ciclo corrente + prossimo ciclo con stessa due_date)
        let filteredInvoices = allInvoices;
        if (avoidDouble) {
            // Mappa (client_slug + due_date) -> esiste una invoice con period_end == due_date?
            const hasEndAtDue = new Set<string>();
            allInvoices.forEach(inv => {
                const due = new Date(inv.due_date);
                const pend = new Date(inv.period_end);
                if (sameDay(due, pend)) {
                    hasEndAtDue.add(`${inv.client_slug}|${due.toDateString()}`);
                }
            });
            filteredInvoices = allInvoices.filter(inv => {
                const due = new Date(inv.due_date);
                const pstart = new Date(inv.period_start);
                const key = `${inv.client_slug}|${due.toDateString()}`;
                // Se esiste già una invoice che termina alla due_date, nascondi la "prossima" che parte alla stessa due_date
                if (sameDay(due, pstart) && hasEndAtDue.has(key)) return false;
                return true;
            });
        }

        // 2) Applica ricerca testuale
        const source = filteredInvoices.filter(r => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const fields = [r.client_name, r.client_slug, r.plan_id, r.id];
            return fields.filter(Boolean).some(v => String(v).toLowerCase().includes(q));
        });

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - (today.getDay() === 0 ? 7 : today.getDay())));
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const forecastWeeks = [
            { name: 'Oggi', total: 0 }, { name: 'Questa Sett.', total: 0 },
            { name: 'Sett. 2', total: 0 }, { name: 'Sett. 3', total: 0 }, { name: 'Sett. 4', total: 0 },
        ];

        filteredInvoices.forEach(inv => {
            const dueDate = new Date(inv.due_date);
            if (dueDate < today) return;
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const remaining = Number(inv.remaining_due || inv.total_gross || 0);

            if (diffDays === 0) forecastWeeks[0].total += remaining;
            else if (diffDays <= 7) forecastWeeks[1].total += remaining;
            else if (diffDays <= 14) forecastWeeks[2].total += remaining;
            else if (diffDays <= 21) forecastWeeks[3].total += remaining;
            else if (diffDays <= 28) forecastWeeks[4].total += remaining;
        });

        const upcoming = source.filter(inv => new Date(inv.due_date) >= today);

        const sixtyAgo = new Date();
        sixtyAgo.setDate(sixtyAgo.getDate() - 60);

        const futureAllRows = filteredInvoices
            .filter(inv => inv.status === 'issued' && new Date(inv.due_date) >= today)
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        return {
            overdueRows: source.filter(inv => new Date(inv.due_date) < today),
            todayRows: upcoming.filter(inv => new Date(inv.due_date).getTime() === today.getTime()),
            thisWeekRows: upcoming.filter(inv => new Date(inv.due_date) > today && new Date(inv.due_date) <= endOfWeek),
            thisMonthRows: upcoming.filter(inv => new Date(inv.due_date) > endOfWeek && new Date(inv.due_date) <= endOfMonth),
            futureRows: upcoming.filter(inv => new Date(inv.due_date) > endOfMonth),
            forecastData: forecastWeeks,
            paidRecentRows: source.filter(r => r.status === 'paid' && new Date(r.paid_at || r.issue_date) >= sixtyAgo),
            futureAllRows,
            allRows: source,
            upcomingCount: (upcoming.length),
            futureCount: (futureAllRows.length),
            overdueCount: (source.filter(inv => new Date(inv.due_date) < today).length),
            paidRecentCount: (source.filter(r => r.status === 'paid' && new Date(r.paid_at || r.issue_date) >= sixtyAgo).length),
            allCount: source.length,
        };
    }, [allInvoices, query, avoidDouble]);

    // --- INTERNAL UI COMPONENTS ---
    // --- INTERNAL UI COMPONENTS ---
    const ClientCell: React.FC<{ inv: InvoiceRow }> = ({ inv }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <a href={`#`} onClick={(e) => { e.preventDefault(); alert(`Navigation to: /admin/clients/${inv.client_slug}`); }} style={{ fontWeight: 500 }}>{inv.client_name || inv.client_slug}</a>
            {inv.subscription_status === 'suspended' && <span className="status-pill suspended">Sospeso</span>}
        </div>
    );

    const DueDateCell: React.FC<{ inv: InvoiceRow }> = ({ inv }) => {
        const now = new Date();
        const due = new Date(inv.due_date);
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{fmtDate(inv.due_date)}</span>
                {diffDays > 0 && <span className="status-pill overdue">{diffDays} gg di ritardo</span>}
            </div>
        );
    };

    const StatusPill: React.FC<{ inv: InvoiceRow }> = ({ inv }) => {
        const label = statusLabel(inv);
        const isOverdue = new Date(inv.due_date) < new Date() && inv.status === 'issued';
        const color = inv.status === 'cancelled' ? '#666' : inv.status === 'paid' ? '#0a7d28' : isOverdue ? '#c62828' : '#b88000';
        const bg = inv.status === 'cancelled' ? '#f2f2f2' : inv.status === 'paid' ? '#e6f5ea' : isOverdue ? '#fdecea' : '#fff8e1';
        return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, color, background: bg, border: '1px solid rgba(0,0,0,0.06)' }}>{label}</span>;
    };

    const Row = ({ inv }: { inv: InvoiceRow }) => (
        <tr>
            <td><ClientCell inv={inv} /></td>
            <td>{inv.plan_id}</td>
            <td>{fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</td>
            <td><DueDateCell inv={inv} /></td>
            <td>
                {fmtEUR(inv.paid_total || 0)} / {fmtEUR(inv.total_gross)}
                <div style={{ height: 6, background: '#eee', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct(Number(inv.paid_total || 0), Number(inv.total_gross || 0))}%`, height: '100%', background: '#0a7d28' }} />
                </div>
            </td>
            <td><b>{fmtEUR(inv.remaining_due || 0)}</b></td>
            <td><StatusPill inv={inv} /></td>
            <td>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {inv.status !== 'cancelled' && Number(inv.remaining_due || 0) > 0 && (
                        <button className="button-primary" onClick={() => setPaying(inv)}>Incassa</button>
                    )}
                    {inv.status === 'issued' && Number(inv.paid_total || 0) === 0 && (
                        <button
                            className="button-danger"
                            onClick={async () => {
                                if (!token) return;
                                const ok = window.confirm('Annullare questa fattura?');
                                if (!ok) return;
                                try {
                                    await cancelInvoice(inv.id, token);
                                    showToast('Fattura annullata', 'success');
                                    refreshCurrentView();
                                } catch (e: any) {
                                    showToast(e?.message || 'Errore annullamento', 'error');
                                }
                            }}
                        >
                            Annulla
                        </button>
                    )}
                    <button className="button-secondary" onClick={() => { setSelected(inv); loadPayments(inv.id); }}>Dettagli</button>
                </div>
            </td>
        </tr>
    );

    const Section = ({ title, rows, total }: { title: string; rows: InvoiceRow[]; total: number; }) => {
        if (rows.length === 0) return null;
        return (
            <div className="admin-widget" style={{ marginTop: '1.5rem' }}>
                <div className="widget-header">
                    <h3 style={{ margin: 0 }}>{title} ({rows.length})</h3>
                    {total > 0 && <div className="widget-toolbar"><span>Totale da incassare: <b>{fmtEUR(total)}</b></span></div>}
                </div>
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Cliente</th><th>Piano</th><th>Periodo</th><th>Scadenza</th>
                                <th>Pagato / Totale</th><th>Residuo</th><th>Stato</th><th>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>{rows.map(inv => <Row key={inv.id} inv={inv} />)}</tbody>
                    </table>
                </div>
            </div>
        )
    };
   
    

    const renderContent = () => {
        if (loading) return <p style={{ padding: '1rem' }}>Caricamento...</p>;
        if (err) return <p style={{ color: 'crimson', padding: '1rem' }}>{err}</p>;

        switch (activeFilter) {
            case 'upcoming':
                const hasUpcomingData = todayRows.length || thisWeekRows.length || thisMonthRows.length || futureRows.length;
                return (
                    <div>
                        {!hasUpcomingData && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                <p style={{ marginTop: 0 }}>Nessuna fattura in scadenza nella finestra prevista.</p>
                                <p style={{ margin: '0.5rem 0 1rem' }}>Vai alla scheda <b>Prossime</b> per vedere tutte le future oppure genera le proforme manualmente.</p>
                                <button
                                    className="button-secondary"
                                    onClick={async () => {
                                        try {
                                            const out = await generateProformasNext(30);
                                            showToast(`${out.inserted || 0} proforme generate`, 'info');
                                            await refreshCurrentView();
                                        } catch (e: any) {
                                            showToast(e?.message || 'Errore generazione proforme', 'error');
                                        }
                                    }}
                                >
                                    Genera proforme prossimi 30 giorni
                                </button>
                            </div>
                        )}
                        <Section title="In Scadenza Oggi" rows={todayRows} total={todayRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0)} />
                        <Section title="In Scadenza Questa Settimana" rows={thisWeekRows} total={thisWeekRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0)} />
                        <Section title="In Scadenza Questo Mese" rows={thisMonthRows} total={thisMonthRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0)} />
                        <Section title="Successivamente" rows={futureRows} total={futureRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0)} />
                    </div>
                );
            case 'future': {
                const total = futureAllRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0);
                if (futureAllRows.length === 0) {
                    return (
                        <div className="admin-widget" style={{ marginTop: '1rem' }}>
                            <div className="widget-header">
                                <h3 style={{ margin: 0 }}>Prossimi incassi (tutte le future)</h3>
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <p style={{ color: '#666', marginTop: 0 }}>
                                    Nessuna proforma futura trovata.
                                    <br />
                                    Probabilmente non sono ancora state emesse (il processo è T-7 giorni dal rinnovo).
                                </p>
                                <button
                                    className="button-primary"
                                    onClick={async () => {
                                        try {
                                            const out = await generateProformasNext(30);
                                            showToast(`${out.inserted || 0} proforme generate`, 'info');
                                            await refreshCurrentView();
                                        } catch (e: any) {
                                            showToast(e?.message || 'Errore generazione proforme', 'error');
                                        }
                                    }}
                                >
                                    Genera proforme prossimi 30 giorni
                                </button>
                            </div>
                        </div>
                    );
                }
                return <Section title="Prossimi incassi (tutte le future)" rows={futureAllRows} total={total} />;
            }
            case 'overdue':
                return <Section title="Fatture Scadute" rows={overdueRows} total={overdueRows.reduce((s, i) => s + Number(i.remaining_due || i.total_gross), 0)} />;
            case 'paid_recent':
                return <Section title={"Pagate di Recente (60gg)"} rows={paidRecentRows} total={0} />;
            case 'all':
                return <Section title={"Tutte le Fatture"} rows={allRows} total={0} />;
            default:
                return null;
        }
    };

  

    const Drawer = ({ inv, onClose }: { inv: InvoiceRow | null; onClose: () => void }) => {
        if (!inv) return null;
        const pmts = paymentsMap[inv.id] || [];
        return (
            <div className="drawer-overlay" onClick={onClose}>
                <div className="drawer-content" onClick={e => e.stopPropagation()}>
                    <div className="drawer-header">
                        <h3 style={{ margin: 0 }}>Dettagli: {inv.client_name || inv.client_slug}</h3>
                        <button className="button-secondary" onClick={onClose}>Chiudi</button>
                    </div>
                    <div className="drawer-body">
                        <p style={{ marginTop: 0 }}>
                            Piano: <b>{inv.plan_id}</b><br />
                            Periodo: <b>{fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</b><br />
                            Scadenza: <b>{fmtDate(inv.due_date)}</b><br />
                            Totale: <b>{fmtEUR(inv.total_gross)}</b> — Pagato: <b>{fmtEUR(inv.paid_total || 0)}</b> — Residuo: <b>{fmtEUR(inv.remaining_due || 0)}</b>
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {Number(inv.remaining_due || 0) > 0 && <button className="button-primary" onClick={() => { onClose(); setPaying(inv); }}>Incassa</button>}
                            {Number(inv.paid_total || 0) > 0 && (
                                <>
                                    <button className="button-secondary" onClick={() => { onClose(); setShowRefund(inv); }}>Rimborso</button>
                                    <button className="button-secondary" onClick={() => { onClose(); setShowChargeback(inv); }}>Chargeback</button>
                                </>
                            )}
                        </div>
                        <h4 style={{ margin: '8px 0' }}>Movimenti</h4>
                        {pmts.length === 0 ? <p style={{ color: '#666' }}>Nessun movimento.</p> : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{pmts.map(p => (
                                <li key={p.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <b style={{ textTransform: 'capitalize' }}>{p.type}</b>
                                        <span>{p.type !== 'refund' && p.type !== 'chargeback' ? '' : '-'}{fmtEUR(p.amount)}</span>
                                    </div>
                                    <div style={{fontSize: 12, color: '#666'}}>
                                        {new Date(p.received_at).toLocaleString('it-IT')}
                                        {p.reference && <> — ref: <code>{p.reference}</code></>}
                                    </div>
                                </li>
                            ))}</ul>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-widget" style={{ border: 'none', padding: 0, background: '#f9fafb' }}>
            <div className="widget-header" style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', zIndex: 5, padding: '0.75rem', borderBottom: '1px solid #eee', backdropFilter: 'blur(8px)' }}>
                <h2 style={{margin: 0}}>Gestione Fatturazione</h2>
                <div className="widget-toolbar">
                    <input type="search" placeholder="Cerca cliente, piano, ID..." value={query} onChange={(e) => setQuery(e.target.value)} style={{minWidth: '250px'}} />
                    <button className="button-secondary" onClick={refreshCurrentView} disabled={loading}>{loading ? 'Aggiorno...' : 'Aggiorna'}</button>
                </div>
            </div>

            <div style={{ padding: '0 0.75rem' }}>
                {/* Previsione incassi (sempre visibile in alto) */}
                <div className="admin-widget" style={{ marginTop: '1rem' }}>
                    <div className="widget-header"><h3 style={{ margin: 0 }}>Previsione Incassi Prossime 4 Settimane</h3></div>
                    <div style={{ height: '250px', padding: '1rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecastData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis tickFormatter={(val) => fmtEUR(val)} fontSize={12} width={80} />
                                <Tooltip formatter={(val: number) => [fmtEUR(val), 'Incasso Previsto']} cursor={{ fill: 'rgba(238, 242, 255, 0.6)' }} />
                                <Bar dataKey="total" fill="#3f51b5" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="filter-pills">
                    <button
                        title="Rinnovi con due_date da oggi in poi, raggruppati (oggi/settimana/mese)."
                        onClick={() => setActiveFilter('upcoming')}
                        className={activeFilter === 'upcoming' ? 'active' : ''}
                    >
                        In scadenza <span className="pill-badge">{upcomingCount}</span>
                    </button>
                    <button
                        title="TUTTE le proforme future (oltre oggi), senza raggruppamento, utile per forecast lungo."
                        onClick={() => setActiveFilter('future')}
                        className={activeFilter === 'future' ? 'active' : ''}
                    >
                        Prossime (tutte) <span className="pill-badge">{futureCount}</span>
                    </button>
                    <button
                        title="Proforme emesse e già scadute (non pagate)."
                        onClick={() => setActiveFilter('overdue')}
                        className={activeFilter === 'overdue' ? 'active' : ''}
                    >
                        Scadute <span className="pill-badge">{overdueCount}</span>
                    </button>
                    <button
                        title="Fatture pagate negli ultimi 60 giorni."
                        onClick={() => setActiveFilter('paid_recent')}
                        className={activeFilter === 'paid_recent' ? 'active' : ''}
                    >
                        Pagate Recenti <span className="pill-badge">{paidRecentCount}</span>
                    </button>
                    <button
                        title="Tutte le fatture visibili nel perimetro attuale."
                        onClick={() => setActiveFilter('all')}
                        className={activeFilter === 'all' ? 'active' : ''}
                    >
                        Tutte <span className="pill-badge">{allCount}</span>
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 8 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' }}>
                        <input type="checkbox" checked={avoidDouble} onChange={(e) => setAvoidDouble(e.target.checked)} />
                        Evita doppie (corrente + prossimo ciclo con stessa scadenza)
                    </label>
                    <span style={{ fontSize: 12, color: '#777' }}>
                        "In scadenza" = vista operativa (oggi/settimana/mese). "Prossime (tutte)" = tutte le future da oggi in poi per forecast.
                    </span>
                </div>
            </div>

            <div style={{padding: '0.75rem'}}>
                {renderContent()}
            </div>
            
            <Drawer inv={selected} onClose={() => setSelected(null)} />
            <PayModal invoice={paying} onClose={() => setPaying(null)} onPaid={() => { refreshCurrentView(); if (selected) { loadPayments(selected.id); } showToast('Pagamento registrato'); }} />
            <RefundModal invoice={showRefund} onClose={() => setShowRefund(null)} onDone={() => { refreshCurrentView(); if (selected) { loadPayments(selected.id); } showToast('Rimborso registrato'); }} />
            <ChargebackModal invoice={showChargeback} onClose={() => setShowChargeback(null)} onDone={() => { refreshCurrentView(); if (selected) { loadPayments(selected.id); } showToast('Chargeback registrato'); }} />
            {toast && (<div className={`toast-notification ${toast.kind}`}>{toast.text}</div>)}
        </div>
    );

    

  
}