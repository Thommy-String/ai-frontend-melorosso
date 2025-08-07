// src/pages/PartnerManager.tsx
// (Questo è il codice che avevamo già sviluppato, ora promosso a componente)
import React, { useState, useEffect, useCallback } from 'react';
import { getPartners, updatePartner } from '../api/api';
import { useAuth } from '../AuthContext';

interface Partner {
    id: string;
    name: string;
    contact_email: string;
    default_commission_rate: number;
}

export default function PartnerManager() {
    const { token } = useAuth();
    const [partners, setPartners] = useState<Partner[]>([]);
    // ... (la logica per creare un nuovo partner può essere aggiunta qui come nel codice precedente)

    useEffect(() => {

        if (!token) return;

        // Passa il token alla chiamata API
        getPartners(token)
            .then(setPartners)
            .catch(err => console.error("Errore nel caricamento dei partner:", err));

    }, [token]);

    // Aggiungi qui la logica per la modifica se vuoi farla inline

    return (
        <div className="admin-widget">
            <h2>Gestione Partner</h2>
            {/* Qui puoi inserire il form per creare nuovi partner */}
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Nome Partner</th>
                        <th>Email</th>
                        <th>Commissione</th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    {partners.map(partner => (
                        <tr key={partner.id}>
                            <td>{partner.name}</td>
                            <td>{partner.contact_email}</td>
                            <td>{(partner.default_commission_rate * 100).toFixed(0)}%</td>
                            <td><button className="admin-button-small">Modifica</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}