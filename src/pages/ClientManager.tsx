// src/pages/ClientManager.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import ClientModal from './ClientModal';
import { getAllClients, getPartners, assignPartnerToClient, impersonateClient, createClient, getPlans } from '../api/api'; import { differenceInDays, format } from 'date-fns';


// --- TIPI E INTERFACCE ---
interface Client {
    slug: string;
    name: string;
    plan_name: string | null;
    partner_id: string | null;
    partner_name: string | null;
    chats_used: number;
    monthly_quota: number;
    renew_date: string;
}
interface Partner {
    id: string;
    name: string;
}

interface NewClientFormData {
    name: string;
    contact_email: string;
    password?: string; // Opzionale se gestito diversamente
    plan_id: string;
    partner_id: string;
}

type SortKey = 'name' | 'plan_name' | 'consumption' | 'renew_date' | 'partner_name';
type SortDirection = 'asc' | 'desc';

// --- COMPONENTE HELPER ---
const ProgressBar = ({ value, max }: { value: number, max: number }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    let colorClass = 'progress-bar-normal';
    if (percentage > 85) colorClass = 'progress-bar-danger';
    else if (percentage > 65) colorClass = 'progress-bar-warning';
    return (
        <div className="progress-bar-container">
            <div className={`progress-bar ${colorClass}`} style={{ width: `${percentage}%` }}></div>
        </div>
    );
};

// ===================================================================
// COMPONENTE PRINCIPALE
// ===================================================================
export default function ClientManager() {
    const { token } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'name', direction: 'asc' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [plans, setPlans] = useState([]);

    const loadData = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [clientsData, partnersData, plansData] = await Promise.all([
                getAllClients(token),
                getPartners(token),
                getPlans(token)
            ]);
            setClients(clientsData.clients);
            setPartners(partnersData);
            setPlans(plansData);
        } catch (error) {
            console.error("Errore caricamento dati:", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const sortedClients = useMemo(() => {
        let sortableClients = [...clients];
        if (sortConfig !== null) {
            sortableClients.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'consumption') {
                    aValue = a.monthly_quota > 0 ? a.chats_used / a.monthly_quota : 0;
                    bValue = b.monthly_quota > 0 ? b.chats_used / b.monthly_quota : 0;
                } else {
                    aValue = a[sortConfig.key] || '';
                    bValue = b[sortConfig.key] || '';
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableClients;
    }, [clients, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortArrow = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };

    // ✅ FUNZIONE RIEMPITA
    const handleAssignPartner = async (slug: string, partner_id: string) => {
        try {
            await assignPartnerToClient(slug, partner_id, token);
            setClients(prevClients =>
                prevClients.map(c => c.slug === slug ? { ...c, partner_id, partner_name: partners.find(p => p.id === partner_id)?.name || null } : c)
            );
        } catch (error) {
            alert("Errore nell'assegnazione del partner.");
        }
    };

    // ✅ FUNZIONE RIEMPITA
    const handleViewAsClient = async (slug: string) => {
        if (!token) {
            alert("Sessione admin non valida. Prova a ricaricare la pagina.");
            return;
        }
        try {
            const { token: tempToken } = await impersonateClient(slug, token);
            const impersonationUrl = `/#/dashboard/${slug}?impersonation_token=${tempToken}`;
            window.open(impersonationUrl, '_blank');
        } catch (error) {
            console.error("Impossibile impersonare il cliente:", error);
            alert("Errore durante l'impersonificazione.");
        }
    };


    const handleAddNewClient = () => setIsModalOpen(true);

    // ✅ FUNZIONE MANCANTE DA AGGIUNGERE
    const handleCloseModal = () => setIsModalOpen(false);

    // ✅ FUNZIONE MANCANTE DA AGGIUNGERE
    const handleSaveClient = async (formData: NewClientFormData) => {
        try {
            await createClient(formData, token); // 'createClient' dovrà essere importato da api.ts
            handleCloseModal();
            // Qui ricaricheremo i dati per mostrare il nuovo cliente
            // loadData(); // (da definire)
        } catch (error) {
            alert("Errore nella creazione del cliente.");
            console.error(error);
        }
    };


    if (loading) return <div className="admin-widget"><h3>Caricamento Clienti...</h3></div>;

    return (
        <div className="admin-widget">
            <div className="widget-header">
                <h2>Gestione Clienti</h2>
            </div>
            <table className="admin-table">
                <thead>
                    <tr>
                        <th onClick={() => requestSort('name')}>Cliente{getSortArrow('name')}</th>
                        <th onClick={() => requestSort('plan_name')}>Piano{getSortArrow('plan_name')}</th>
                        <th onClick={() => requestSort('consumption')}>Consumo Chat{getSortArrow('consumption')}</th>
                        <th onClick={() => requestSort('renew_date')}>Prossimo Rinnovo{getSortArrow('renew_date')}</th>
                        <th onClick={() => requestSort('partner_name')}>Partner{getSortArrow('partner_name')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedClients.map(client => {
                        const daysToRenewal = client.renew_date ? differenceInDays(new Date(client.renew_date), new Date()) : null;
                        return (
                            <tr key={client.slug}>
                                <td>
                                    {/* ✅ NOME CLIENTE ORA CLICCABILE */}
                                    <a href="#" onClick={(e) => { e.preventDefault(); handleViewAsClient(client.slug); }} className="admin-link">
                                        {client.name}
                                    </a>
                                </td>
                                <td>{client.plan_name || 'N/A'}</td>
                                <td>
                                    <div className="consumption-cell">
                                        <span>{client.chats_used ?? 0} / {client.monthly_quota ?? '∞'}</span>
                                        {client.monthly_quota && <ProgressBar value={client.chats_used} max={client.monthly_quota} />}
                                    </div>
                                </td>
                                <td>
                                    {client.renew_date && daysToRenewal !== null ? (
                                        <>
                                            {format(new Date(client.renew_date), 'dd/MM/yyyy')}
                                            <span className="days-left"> ({daysToRenewal} giorni)</span>
                                        </>
                                    ) : 'N/A'}
                                </td>
                                <td>
                                    <select
                                        value={client.partner_id || ''}
                                        onChange={(e) => handleAssignPartner(client.slug, e.target.value)}
                                        className="partner-select"
                                    >
                                        <option value="">-- Nessun Partner --</option>
                                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            <ClientModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveClient}
                plans={plans}
                partners={partners}
            />
        </div>
    );
}