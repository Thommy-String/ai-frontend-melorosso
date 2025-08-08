// src/pages/PartnerManager.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
    getPartners,
    getPartnersSummary,
    createPartner,
    updatePartner,
    type NewPartner,
    type PartnerPatch,
} from '../api/api';
import { useAuth } from '../AuthContext';

/* ------------------------------------------------------------------ */
/* TYPES (tolleranti lato FE: campi opzionali = meno attriti TS)      */
/* ------------------------------------------------------------------ */
export interface Partner {
    id: string;
    name: string;
    contact_email: string;
    phone_number?: string | null;
    iban?: string | null;
    vat_number?: string | null;
    default_commission_rate?: number | null; // 0..1
    created_at?: string;
}

// --- Summary Types ---
interface PartnerPlanBucket {
    plan_id: string;
    plan_name: string;
    count: number;
}

interface PartnerSummaryItem {
    partner_id: string;
    name: string;
    default_commission_rate: number; // 0..1
    total_clients: number;
    clients_per_plan: PartnerPlanBucket[];
    monthly_owed_eur: number; // somma(price_eur * commission_rate) per i clienti del partner
}

// Helper to normalize API summary row to the expected PartnerSummaryItem shape
function normalizeSummaryRow(row: any): PartnerSummaryItem {
    const monthly = Number(
        row?.monthly_owed_eur ??
        row?.commission_owed_monthly ??
        row?.monthly_owed ??
        0
    );

    let buckets: PartnerPlanBucket[] = [];
    if (Array.isArray(row?.clients_per_plan)) {
        buckets = row.clients_per_plan.map((b: any) => ({
            plan_id: String(b.plan_id ?? b.plan_name ?? ''),
            plan_name: String(b.plan_name ?? b.plan_id ?? ''),
            count: Number(b.count ?? 0),
        }));
    } else if (row?.clients_per_plan && typeof row.clients_per_plan === 'object') {
        // Handle object map form { planName: count }
        buckets = Object.entries(row.clients_per_plan).map(([plan_name, count]) => ({
            plan_id: String(plan_name),
            plan_name: String(plan_name),
            count: Number(count as any ?? 0),
        }));
    }

    return {
        partner_id: String(row.partner_id ?? row.id ?? ''),
        name: String(row.name ?? ''),
        default_commission_rate: Number(row.default_commission_rate ?? row.commission_rate ?? 0),
        total_clients: Number(row.total_clients ?? 0),
        clients_per_plan: buckets,
        monthly_owed_eur: isNaN(monthly) ? 0 : monthly,
    };
}

/* Valori form permessi (create + edit) */
type PartnerFormValues = Partial<{
    name: string;
    contact_email: string;
    password: string; // solo creazione
    phone_number: string;
    iban: string;
    vat_number: string;
    default_commission_rate: string | number; // accetto string da <input>
}>;

type PartnerInitialValues = Partial<{
    id: string;
    name: string;
    contact_email: string;
    phone_number: string | null;
    iban: string | null;
    vat_number: string | null;
    default_commission_rate: number | null; // 0..1
}>;

/* ------------------------------------------------------------------ */
/* UTILS                                                              */
/* ------------------------------------------------------------------ */
function toNumberOrUndefined(v: unknown): number | undefined {
    if (typeof v === 'number') return isNaN(v) ? undefined : v;
    if (typeof v === 'string') {
        const n = Number(v.replace(',', '.').trim());
        return isNaN(n) ? undefined : n;
    }
    return undefined;
}

function clamp01(n: number | undefined): number | undefined {
    if (n == null) return undefined;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

function fmtPct(n?: number | null): string {
    if (n == null) return '-';
    return `${(n * 100).toFixed(0)}%`;
}

/* ------------------------------------------------------------------ */
/* MODAL                                                              */
/* ------------------------------------------------------------------ */
function PartnerModal({
    isOpen,
    onClose,
    onSave,
    initialValues,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vals: PartnerFormValues) => void;
    initialValues?: PartnerInitialValues;
}) {
    if (!isOpen) return null;
    const isEdit = Boolean(initialValues?.id);

    const iv = {
        name: initialValues?.name ?? '',
        contact_email: initialValues?.contact_email ?? '',
        phone_number: initialValues?.phone_number ?? '',
        iban: initialValues?.iban ?? '',
        vat_number: initialValues?.vat_number ?? '',
        default_commission_rate:
            initialValues?.default_commission_rate ?? 0.2, // default 20%
    };

    const [rate, setRate] = useState<string>(
        String(iv.default_commission_rate)
    );

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const raw = Object.fromEntries(fd.entries()) as Record<string, FormDataEntryValue>;

        const toStr = (v: FormDataEntryValue | undefined) =>
            (typeof v === 'string' ? v.trim() : '') || undefined;

        // Normalizzo la commissione (input come numero 0..1; se qualcuno digita 20, la clampo a 1)
        let commission = clamp01(toNumberOrUndefined(rate));
        // tolleranza: se l’utente inserisce “20” interpretalo come 0.20
        if (commission && commission > 1) commission = commission / 100;

        const values: PartnerFormValues = {
            name: toStr(raw.name),
            contact_email: toStr(raw.contact_email),
            phone_number: toStr(raw.phone_number),
            iban: toStr(raw.iban),
            vat_number: toStr(raw.vat_number),
            default_commission_rate: commission,
            password: toStr(raw.password), // solo create; se edit e vuota, la rimuovo sotto
        };

        if (isEdit && !values.password) {
            delete values.password;
        }
        onSave(values);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 640 }}>
                <h2>{isEdit ? 'Modifica Partner' : 'Nuovo Partner'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Nome</label>
                        <input id="name" name="name" type="text" required defaultValue={iv.name} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="contact_email">Email (login)</label>
                        <input
                            id="contact_email"
                            name="contact_email"
                            type="email"
                            required
                            defaultValue={iv.contact_email}
                        />
                    </div>

                    {!isEdit && (
                        <div className="form-group">
                            <label htmlFor="password">Password iniziale</label>
                            <input id="password" name="password" type="password" required />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="phone_number">Telefono</label>
                        <input id="phone_number" name="phone_number" type="text" defaultValue={iv.phone_number || ''} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="iban">IBAN</label>
                        <input id="iban" name="iban" type="text" defaultValue={iv.iban || ''} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="vat_number">Partita IVA</label>
                        <input id="vat_number" name="vat_number" type="text" defaultValue={iv.vat_number || ''} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="default_commission_rate">
                            Commissione predefinita (0–1) — es. 0.2 = 20%
                        </label>
                        <input
                            id="default_commission_rate"
                            name="default_commission_rate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>
                            Annulla
                        </button>
                        <button type="submit" className="button-primary">
                            Salva
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* PARTNER MANAGER                                                    */
/* ------------------------------------------------------------------ */
export default function PartnerManager() {
    const { token } = useAuth();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [summaries, setSummaries] = useState<PartnerSummaryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [err, setErr] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partner | null>(null);
    const [query, setQuery] = useState<string>('');

    const filteredPartners = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return partners;
        return partners.filter(p =>
            [p.name, p.contact_email, p.phone_number, p.vat_number]
                .filter(Boolean)
                .some(v => String(v).toLowerCase().includes(q))
        );
    }, [partners, query]);

    const filteredSummaries = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return summaries;
        return summaries.filter(s => s.name.toLowerCase().includes(q));
    }, [summaries, query]);

    const openCreate = () => { setEditing(null); setIsModalOpen(true); };
    const openEdit = (p: Partner) => { setEditing(p); setIsModalOpen(true); };

    const load = async () => {
        if (!token) return;
        setLoading(true);
        setErr(null);
        try {
            // elenco partner per tabella
            const list = await getPartners(token);
            setPartners(Array.isArray(list) ? list : []);

            // riepilogo per partner (tot clienti, per piano, importo mensile dovuto)
            const s = await getPartnersSummary(token);
            const norm = Array.isArray(s) ? s.map(normalizeSummaryRow) : [];
            setSummaries(norm);
        } catch (e: any) {
            setErr(e?.message || 'Errore nel caricamento partner');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [token]);

    const handleSave = async (vals: PartnerFormValues) => {
        if (!token) return;

        try {
            if (editing) {
                // EDIT
                const patch: PartnerPatch = {};
                if (vals.name !== undefined) patch.name = vals.name;
                if (vals.contact_email !== undefined) patch.contact_email = vals.contact_email;
                if (vals.phone_number !== undefined) patch.phone_number = vals.phone_number;
                if (vals.iban !== undefined) patch.iban = vals.iban;
                if (vals.vat_number !== undefined) patch.vat_number = vals.vat_number;
                if (vals.default_commission_rate !== undefined) {
                    const n = toNumberOrUndefined(vals.default_commission_rate);
                    patch.default_commission_rate = clamp01(n);
                }
                if (vals.password) patch.password = vals.password;

                await updatePartner(editing.id, patch, token);
            } else {
                // CREATE
                const n = toNumberOrUndefined(vals.default_commission_rate);
                const payload: NewPartner = {
                    name: vals.name || '',
                    contact_email: vals.contact_email || '',
                    password: vals.password || '',
                    phone_number: vals.phone_number || undefined,
                    iban: vals.iban || undefined,
                    vat_number: vals.vat_number || undefined,
                    default_commission_rate: clamp01(n) ?? 0.2,
                };
                await createPartner(payload, token);
            }

            setIsModalOpen(false);
            setEditing(null);
            await load();
        } catch (e: any) {
            alert(e?.message || 'Errore nel salvataggio partner');
        }
    };

    const columns = useMemo(
        () => [
            { key: 'name', label: 'Nome' },
            { key: 'contact_email', label: 'Email' },
            { key: 'phone_number', label: 'Telefono' },
            { key: 'vat_number', label: 'P. IVA' },
            { key: 'default_commission_rate', label: 'Commissione' },
            { key: 'actions', label: '' },
        ],
        []
    );

    // in src/pages/PartnerManager.tsx

    return (
        <div className="admin-widget"> {/* Usa admin-widget invece di 'panel' per coerenza */}
            <div className="widget-header">
                <h2>Gestione Partner</h2>
                <div className="widget-toolbar">
                    <input
                        type="search"
                        placeholder="Cerca partner…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="button-primary" onClick={openCreate}>Nuovo Partner</button>
                </div>
            </div>

            {loading && <p>Caricamento...</p>}
            {err && <p style={{ color: 'crimson' }}>{err}</p>}

            {/* PANORAMICA PARTNER */}
            {!loading && filteredSummaries.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0' }}>Panoramica Mensile</h3>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Partner</th>
                                    <th>Clienti Totali</th>
                                    <th>Clienti per Piano</th>
                                    <th>Dovuto Mensile (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSummaries.map((row) => (
                                    <tr key={row.partner_id}>
                                        <td data-label="Partner">{row.name}</td>
                                        <td data-label="Clienti Totali">{row.total_clients}</td>
                                        <td data-label="Clienti per Piano">
                                            {row.clients_per_plan?.length > 0 ? (
                                                <div className="plan-distribution-cell">
                                                    {row.clients_per_plan.map((b) => (
                                                        <span key={b.plan_id}>{b.plan_name}: <strong>{b.count}</strong></span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </td>
                                        <td data-label="Dovuto Mensile (€)">{(row.monthly_owed_eur ?? 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DETTAGLIO PARTNER */}
            {!loading && filteredPartners.length > 0 && (
                <div>
                    <h3 style={{ margin: '0 0 0.75rem 0' }}>Dettaglio Partner</h3>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Telefono</th>
                                    <th>P. IVA</th>
                                    <th>Commissione</th>
                                    <th>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPartners.map((p) => (
                                    <tr key={p.id}>
                                        <td data-label="Nome" className="partner-name">{p.name}</td>
                                        <td data-label="Email"><div className="partner-email">{p.contact_email}</div></td>
                                        <td data-label="Telefono">{p.phone_number || '-'}</td>
                                        <td data-label="P. IVA">{p.vat_number || '-'}</td>
                                        <td data-label="Commissione">{fmtPct(p.default_commission_rate)}</td>
                                        <td data-label="Azioni">
                                            <button className="button-secondary" onClick={() => openEdit(p)}>Modifica</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && partners.length === 0 && (
                <p>Nessun partner. Crea il primo partner con il pulsante in alto.</p>
            )}

            <PartnerModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditing(null); }}
                onSave={handleSave}
                initialValues={editing ?? undefined}
            />
        </div>
    );
}