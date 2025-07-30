// src/components/ContactRequestSection.tsx - VERSIONE CORRETTA
import React from 'react';
import './ContactRequestSection.css'; // Assicurati di avere un file CSS per questo componente se necessario

export interface ContactRequest {
  session_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface ContactRequestsSectionProps {
  requests: ContactRequest[];
  onShowHistory: (request: ContactRequest) => void; 
}

export default function ContactRequestsSection({ requests, onShowHistory }: ContactRequestsSectionProps) {
  return (
    <div className="contact-requests-section">
      <div className="content-section">
        <h2 className="section-title">Richieste di Contatto Ricevute</h2>
        <p className="section-subtitle">Gli ultimi lead generati dal tuo assistente AI. Clicca su una riga per vedere la chat.</p>
        <ul className="contact-requests-list">
          {requests.map((req) => (
            // ✅ CORREZIONE: Passiamo l'intero oggetto 'req' invece del solo 'req.session_id'
            <li key={req.session_id} className="contact-request-item clickable" onClick={() => onShowHistory(req)}>
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div className="contact-info">
                <div className="contact-main">
                  <span className="contact-name">{req.name}</span>
                  <span className="contact-phone">{req.phone}</span>
                  <span className={`status-badge status-${req.status}`}>{req.status}</span>
                </div>
                {req.email && <div className="contact-detail"><strong>Email:</strong> {req.email}</div>}
                {req.notes && <div className="contact-detail"><strong>Note:</strong> {req.notes}</div>}
              </div>
              <div className="contact-time">
                {new Date(req.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}