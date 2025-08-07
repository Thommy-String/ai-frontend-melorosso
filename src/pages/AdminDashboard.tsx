// src/pages/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { getAdminMetrics } from '../api/api';
import ClientManager from './ClientManager'; // Componente che creeremo
import PartnerManager from './PartnerManager'; // Componente che creeremo
import CommissionReport from './CommissionReport'; // Componente che creeremo
import { useAuth } from '../AuthContext';
import './AdminDashboard.css';


interface PlanDistribution {
  name: string;
  client_count: number;
}

interface AdminMetrics {
  totalClients: number;
  mrr: number; // Monthly Recurring Revenue
  newClientsLast30d: number;
  totalPartners: number;
  clientsPerPlan: PlanDistribution[] | null;
}



const MetricCard = ({ title, value }: { title: string, value: string | number }) => (
  <div className="metric-card-admin">
    <div className="metric-title">{title}</div>
    <div className="metric-value">{value}</div>
  </div>
);

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {

    if (!token) {
      setLoading(false); // Smettiamo di caricare se non c'è token
      return;
    }

    const loadMetrics = async () => {
      try {
        setLoading(true);
        // ✅ CORREZIONE: Passa il token alla funzione API
        const data = await getAdminMetrics(token);
        setMetrics(data);
      } catch (error) {
        console.error("Errore nel caricamento delle metriche:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [token]);

  if (loading) return <div>Caricamento pannello di amministrazione...</div>;


  const PlanDistributionCard = ({ plans }: { plans: PlanDistribution[] | null }) => (
    <div className="metric-card-admin">
      <div className="metric-title">Clienti per Piano</div>
      <div className="plan-distribution">
        {plans && plans.length > 0 ? (
          plans.map(plan => (
            <div key={plan.name} className="plan-row">
              <span className="plan-name">{plan.name}</span>
              <span className="plan-count">{plan.client_count}</span>
            </div>
          ))
        ) : (
          <p>Nessun cliente attivo.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Pannello di Controllo Admin</h1>
      </header>

      <div className="metrics-grid-admin">
        {/* ✅ CORREZIONE: Usiamo String() per garantire che il valore sia sempre una stringa valida */}
        <MetricCard title="Clienti Attivi Totali" value={String(metrics?.totalClients ?? 'N/D')} />

        {/* ✅ CORREZIONE: Gestiamo il caso in cui mrr possa non essere un numero valido */}
        <MetricCard
          title="Fatturato Mensile (MRR)"
          value={metrics ? `€${Number(metrics.mrr || 0).toFixed(2)}` : 'N/D'}
        />

        {/* ✅ CORREZIONE: Applichiamo la stessa coerenza a tutte le card */}
        <MetricCard title="Nuovi Clienti (30gg)" value={String(metrics?.newClientsLast30d ?? 'N/D')} />

        <PlanDistributionCard plans={metrics?.clientsPerPlan ?? null} />

        <MetricCard title="Partner Totali" value={String(metrics?.totalPartners ?? 'N/D')} />
      </div>

      <div className="admin-main-content">
        <ClientManager />
        <PartnerManager />
        <CommissionReport />
      </div>
    </div>
  );
}