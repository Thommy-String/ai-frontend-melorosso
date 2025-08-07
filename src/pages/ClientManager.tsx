// src/pages/ClientManager.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import ClientModal from './ClientModal';
import {
    getAllClients,
    getPartners,
    assignPartnerToClient,
    impersonateClient,
    createClient,
    updateClient,
    getPlans,
} from '../api/api';
import { differenceInDays, format } from 'date-fns';

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

interface Client {
    slug: string;
    name: string;
    contact_email: string | null;
    billing_email: string | null;
    plan_id: string | null;
    plan_name: string | null;
    partner_id: string | null;
    partner_name: string | null;
    chats_used: number;
    monthly_quota: number;
    renew_date: string;
}
interface Partner { id: string; name: string }

interface NewClientFormData {
    name: string;
    contact_email: string;
    billing_email: string;
    password?: string;
    plan_id: string;
    partner_id: string;
}

type SortKey = 'name' | 'plan_name' | 'consumption' | 'renew_date' | 'partner_name';
type SortDirection = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */

const ProgressBar = ({ value, max }: { value: number; max: number }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const cls =
        pct > 85 ? 'danger' : pct > 65 ? 'warning' : 'normal';
    return (
        <div className="progress-bar-container">
            <div className={`progress-bar progress-bar-${cls}`} style={{ width: `${pct}%` }} />
        </div>
    );
};

/** rimuove chiavi con stringa vuota / undefined */
const clean = (obj: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== '' && v !== undefined),
    );

/* ------------------------------------------------------------------ */
/* COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function ClientManager() {
    const { token } = useAuth();

    const [clients, setClients] = useState<Client[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
        key: 'name',
        direction: 'asc',
    });

    const [modal, setModal] = useState<
        | null
        | { mode: 'create' }
        | { mode: 'edit'; data: Client }
    >(null);

    /* ------------ LOAD DATA ------------ */
    const loadData = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [c, p, pl] = await Promise.all([
                getAllClients(token),
                getPartners(token),
                getPlans(token),
            ]);
            setClients(c.clients);
            setPartners(p);
            setPlans(pl);
        } catch (err) {
            console.error('Errore caricamento dati:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadData(); }, [loadData]);

    /* ------------ SORT ------------ */
    const sortedClients = useMemo(() => {
        if (!sortConfig) return clients;
        return [...clients].sort((a, b) => {
            const { key, direction } = sortConfig;
            const dir = direction === 'asc' ? 1 : -1;
            const aVal =
                key === 'consumption'
                    ? (a.chats_used / (a.monthly_quota || 1))
                    : (a as any)[key] || '';
            const bVal =
                key === 'consumption'
                    ? (b.chats_used / (b.monthly_quota || 1))
                    : (b as any)[key] || '';
            if (aVal < bVal) return -1 * dir;
            if (aVal > bVal) return 1 * dir;
            return 0;
        });
    }, [clients, sortConfig]);

    const toggleSort = (key: SortKey) => {
        setSortConfig((prev) =>
            prev && prev.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'asc' },
        );
    };

    /* ------------ PARTNER ASSIGN ------------ */
    const handleAssignPartner = async (slug: string, partner_id: string) => {
        try {
            await assignPartnerToClient(slug, partner_id || null, token);
            setClients((prev) =>
                prev.map((c) =>
                    c.slug === slug
                        ? { ...c, partner_id: partner_id || null, partner_name: partners.find((p) => p.id === partner_id)?.name || null }
                        : c,
                ),
            );
        } catch (err) {
            alert('Errore assegnazione partner');
        }
    };

    /* ------------ IMPERSONATE ------------ */
    const handleViewAsClient = async (slug: string) => {
        try {
            const { token: temp } = await impersonateClient(slug, token);
            window.open(`/#/dashboard/${slug}?impersonation_token=${temp}`, '_blank');
        } catch (err) {
            alert('Impersonificazione fallita');
        }
    };

    /* ------------ SAVE (CREATE / UPDATE) ------------ */
    const handleSaveClient = async (data: any) => {
        try {
            if (!modal) return;

            if (modal.mode === 'create') {
                await createClient(data, token);
            } else {
                const patch = clean(data);
                if (patch.partner_id === '') patch.partner_id = null;
                await updateClient(modal.data.slug, patch, token);
            }

            await loadData();
            setModal(null);
        } catch (err) {
            alert('Errore salvataggio');
            console.error(err);
        }
    };

    /* ------------ RENDER ------------ */
    if (loading) return <div className="admin-widget">Caricamento…</div>;

    return (
        <div className="admin-widget">
            <div className="widget-header">
                <h2>Gestione Clienti</h2>
                <button className="button-primary" onClick={() => setModal({ mode: 'create' })}>
                    + Nuovo 👤
                </button>
            </div>

            {/* ---------- TABLE ---------- */}
            <table className="admin-table">
                <thead>
                    <tr>
                        <th onClick={() => toggleSort('name')}>Cliente </th>
                        <th onClick={() => toggleSort('plan_name')}>Piano</th>
                        <th onClick={() => toggleSort('consumption')}>Consumo Chat</th>
                        <th onClick={() => toggleSort('renew_date')}>Prossimo Rinnovo</th>
                        <th onClick={() => toggleSort('partner_name')}>Partner</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedClients.map((c) => {
                        const days = differenceInDays(new Date(c.renew_date), new Date());
                        return (
                            <tr key={c.slug}>

                                <td data-label="Cliente">
                                    <a href="#" onClick={(e) => { e.preventDefault(); handleViewAsClient(c.slug); }}>
                                        {c.name}
                                    </a>
                                    <button className="btn-edit-client" onClick={() => setModal({ mode: 'edit', data: c })}>
                                        ⚙️
                                    </button>
                                </td>
                                <td data-label="Piano">{c.plan_name ?? '—'}</td>
                                <td data-label="Consumo">
                                    <div className="consumption-cell">
                                        {c.chats_used} / {c.monthly_quota ?? '∞'}
                                        {c.monthly_quota && <ProgressBar value={c.chats_used} max={c.monthly_quota} />}
                                    </div>
                                </td>
                                <td data-label="Prossimo Rinnovo">
                                    {format(new Date(c.renew_date), 'dd/MM/yyyy')}
                                    <span className="days-left"> ({days} gg)</span>
                                </td>
                                <td data-label="Partner">
                                    {c.partner_name ?? '—'}

                                </td>

                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* ---------- MODAL ---------- */}
            {modal && (
                <ClientModal
                    isOpen
                    initialValues={
                        modal.mode === 'edit'
                            ? { ...modal.data, partner_id: modal.data.partner_id ?? '', plan_id: modal.data.plan_id ?? '' }
                            : undefined
                    }
                    plans={plans}
                    partners={partners}
                    onClose={() => setModal(null)}
                    onSave={handleSaveClient}
                />
            )}
        </div>
    );
}