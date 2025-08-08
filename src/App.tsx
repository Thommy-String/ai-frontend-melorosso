// App.tsx ------------------------------------------------------------
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login from './pages/Login';
import PartnerLogin from './pages/PartnerLogin';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PartnerDashboard from './pages/PartnerDashboard';
import Insights from './pages/Insights';
import ChatWidget from './ChatWidget';
import TokenHandler from './pages/TokenHandler';
import { useAuth } from './AuthContext';

/* ---------- tema per singolo client (invariato) ------------------- */
const brand = (slug: string) => ({
  barilla: {
    accent: '#0057B7',
    logoUrl: 'https://www.barilla.com/favicon.ico',
    start: 'Chiedimi tutto su Barilla…'
  },
  'custom-light-garage': {
    accent: '#FF4E00',
    logoUrl: '/clg_logo.svg',
    start: 'Cosa vuoi illuminare oggi?'
  }
}[slug] ?? {
  accent: '#3b82f6',
  logoUrl: '/bot.png',
  start: 'Scrivi…'
});

/* ---------- helper per analizzare il token (invariato) -------------- */
function parseTokenPayload(token?: string | null): { slug?: string; partner_id?: string; admin?: boolean } | null {
  if (!token) return null;
  try {
    const [, p] = token.split('.');
    const base64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/* ---------- wrapper /chat/:slug (invariato) ----------------------- */
function ChatRoute() {
  const { slug = 'barilla' } = useParams();
  const { accent, logoUrl, start } = brand(slug);
  return (
    <ChatWidget
      slug={slug}
      accent={accent}
      logoUrl={logoUrl}
      startText={start}
      floating={false}
    />
  );
}

/* =========================== APP ================================= */
export default function App() {
  // token = effettivo per admin/client (rispetta eventuale impersonation)
  const { token, partnerToken } = useAuth();

  const payload = parseTokenPayload(token);
  const isAdmin = payload?.admin === true;

  const partnerPayload = parseTokenPayload(partnerToken);

  return (
    <Router>
      <TokenHandler />
      <Routes>
        {/* --- ROTTE DI LOGIN --- */}
        <Route
          path="/login"
          element={
            !token
              ? <Login />
              : <Navigate to={isAdmin ? '/admin' : `/dashboard/${payload?.slug}`} replace />
          }
        />

        <Route
          path="/partner/login"
          element={
            !partnerToken
              ? <PartnerLogin />
              : partnerPayload?.partner_id
                ? <Navigate to="/partner/dashboard" replace />
                : <PartnerLogin />
          }
        />

        {/* --- ROTTE PROTETTE --- */}
        <Route
          path="/admin"
          element={token && isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/dashboard/:slug"
          element={token && payload?.slug ? <Dashboard /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/insights/:slug"
          element={token && payload?.slug ? <Insights /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/chat/:slug"
          element={token && payload?.slug ? <ChatRoute /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/partner/dashboard"
          element={partnerToken && partnerPayload?.partner_id ? <PartnerDashboard /> : <Navigate to="/partner/login" replace />}
        />

        {/* --- ROTTA DI DEFAULT / FALLBACK --- */}
        <Route
          path="*"
          element={
            (() => {
              // 1) Se sei partner loggato, vai alla partner dashboard
              if (partnerToken && partnerPayload?.partner_id) {
                return <Navigate to="/partner/dashboard" replace />;
              }
              // 2) Se non hai token utente, vai al login utente
              if (!token || !payload) {
                return <Navigate to="/login" replace />;
              }
              // 3) Admin
              if (isAdmin) {
                return <Navigate to="/admin" replace />;
              }
              // 4) Cliente
              if (payload.slug) {
                return <Navigate to={`/dashboard/${payload.slug}`} replace />;
              }
              // 5) Fallback sicuro
              return <Navigate to="/login" replace />;
            })()
          }
        />
      </Routes>
    </Router>
  );
}