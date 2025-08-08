// src/pages/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { getAdminMetrics, getPartnersSummary } from '../api/api';
import ClientManager from './ClientManager';
import PartnerManager from './PartnerManager';
import CommissionReport from './CommissionReport';
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
  newClientsOwnLast30d?: number;
  newClientsFromPartnersLast30d?: number;
  totalPartners: number;
  clientsPerPlan: PlanDistribution[] | null;
}

const MetricCard = ({ title, value, sub }: { title: string; value: string | number; sub?: React.ReactNode }) => (
  <div className="metric-card-admin">
    <div className="metric-title">{title}</div>
    <div className="metric-value">{value}</div>
    {sub ? <div className="metric-subtext">{sub}</div> : null}
  </div>
);

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  // Totale commissioni dovute ai partner e percentuale su MRR
  const [partnersOwed, setPartnersOwed] = useState<number>(0);
  const [partnersOwedPct, setPartnersOwedPct] = useState<number>(0);

  const [partnerClients, setPartnerClients] = useState<number>(0);
  const [ownClients, setOwnClients] = useState<number>(0);
  const [partnerClientsPct, setPartnerClientsPct] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);

        // Metriche principali
        const data = await getAdminMetrics(token);
        setMetrics(data);

        // Riepilogo partner per calcolare totale dovuto (somma commissioni)
        try {
          const summary = await getPartnersSummary(token);
          const totalOwed = Array.isArray(summary)
            ? summary
              .filter((row: any) => String(row?.name ?? '').toLowerCase() !== 'melorosso')
              .reduce(
                (acc: number, row: any) =>
                  acc + Number(row?.commission_owed_monthly ?? row?.monthly_owed_eur ?? 0),
                0
              )
            : 0;

          setPartnersOwed(totalOwed);

          // Split clienti: partner vs nostri
          const partnerCnt = Array.isArray(summary)
            ? summary
              .filter((row: any) => String(row?.name ?? '').toLowerCase() !== 'melorosso')
              .reduce((acc: number, row: any) => acc + Number(row?.total_clients ?? 0), 0)
            : 0;
          const totalClients = Number(data?.totalClients || 0);
          const ownCnt = Math.max(totalClients - partnerCnt, 0);
          setPartnerClients(partnerCnt);
          setOwnClients(ownCnt);
          setPartnerClientsPct(totalClients > 0 ? (partnerCnt / totalClients) * 100 : 0);

          const mrrNum = Number(data?.mrr || 0);
          setPartnersOwedPct(mrrNum > 0 ? (totalOwed / mrrNum) * 100 : 0);
        } catch {
          setPartnersOwed(0);
          setPartnersOwedPct(0);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle metriche:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  if (loading) return <div>Caricamento pannello di amministrazione...</div>;

  const PlanDistributionCard = ({ plans }: { plans: PlanDistribution[] | null }) => (
    <div className="metric-card-admin">
      <div className="metric-title">Clienti per Piano</div>
      <div className="plan-distribution">
        {plans && plans.length > 0 ? (
          plans.map((plan) => (
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

  const mrr = Number(metrics?.mrr || 0);
  const owed = Number(partnersOwed || 0);
  const net = mrr - owed;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Pannello di Controllo Amministrazione</h1>
      </header>

      <div className="metrics-grid-admin">
        <MetricCard
          title="Clienti Totali"
          value={String(metrics?.totalClients ?? 'N/D')}
          sub={
            <div className="metric-split">
              <div className="metric-split-legend">
                <span>Nostri: <strong>{ownClients}</strong></span>
                <span>Partner: <strong>{partnerClients}</strong> ({partnerClientsPct.toFixed(1)}%)</span>
              </div>
              <div className="metric-split-bar">
                <div
                  className="metric-split-own"
                  style={{ width: `${(metrics?.totalClients ? (ownClients / Number(metrics.totalClients)) * 100 : 0).toFixed(2)}%` }}
                />
                <div
                  className="metric-split-partner"
                  style={{ width: `${(metrics?.totalClients ? (partnerClients / Number(metrics.totalClients)) * 100 : 0).toFixed(2)}%` }}
                />
              </div>
            </div>
          }
        />

        <MetricCard
          title="Fatturato Mensile (MRR)"
          value={metrics ? `€${mrr.toFixed(2)}` : 'N/D'}
          sub={
            <div className="metric-split">
              <div className="metric-split-legend">
                <span>Netto: <strong>€{net.toFixed(2)}</strong></span>
                <span>Partner: <strong>€{owed.toFixed(2)}</strong> ({partnersOwedPct.toFixed(1)}%)</span>
              </div>
              <div className="metric-split-bar">
                <div
                  className="metric-split-own"
                  style={{ width: `${(mrr > 0 ? (net / mrr) * 100 : 0).toFixed(2)}%` }}
                />
                <div
                  className="metric-split-partner"
                  style={{ width: `${(mrr > 0 ? (owed / mrr) * 100 : 0).toFixed(2)}%` }}
                />
              </div>
            </div>
          }
        />

        <MetricCard
          title="Da Dare ai Partner"
          value={`€${owed.toFixed(2)}`}
          sub={`${partnersOwedPct.toFixed(1)}% del MRR`}
        />

        <MetricCard
          title="Nuovi Clienti (30gg)"
          value={String(metrics?.newClientsLast30d ?? 'N/D')}
          sub={
            <div className="metric-split">
              <div className="metric-split-legend">
                <span>Nostri: <strong>{Number(metrics?.newClientsOwnLast30d || 0)}</strong></span>
                <span>
                  Partner: <strong>{Number(metrics?.newClientsFromPartnersLast30d || 0)}</strong>{' '}
                  ({(() => {
                    const own = Number(metrics?.newClientsOwnLast30d || 0);
                    const par = Number(metrics?.newClientsFromPartnersLast30d || 0);
                    const tot = own + par || Number(metrics?.newClientsLast30d || 0);
                    return tot > 0 ? ((par / tot) * 100).toFixed(1) : '0.0';
                  })()}%)
                </span>
              </div>
              <div className="metric-split-bar">
                {(() => {
                  const own = Number(metrics?.newClientsOwnLast30d || 0);
                  const par = Number(metrics?.newClientsFromPartnersLast30d || 0);
                  const tot = own + par || Number(metrics?.newClientsLast30d || 0);
                  const ownPct = tot > 0 ? (own / tot) * 100 : 0;
                  const parPct = tot > 0 ? (par / tot) * 100 : 0;
                  return (
                    <>
                      <div className="metric-split-own" style={{ width: `${ownPct.toFixed(2)}%` }} />
                      <div className="metric-split-partner" style={{ width: `${parPct.toFixed(2)}%` }} />
                    </>
                  );
                })()}
              </div>
            </div>
          }
        />
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