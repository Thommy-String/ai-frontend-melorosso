// App.tsx ------------------------------------------------------------
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login from './pages/Login';
import PartnerLogin from './pages/PartnerLogin';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard'; // Assicurati che questo import sia corretto
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
  const { token } = useAuth();
  const payload = parseTokenPayload(token);
  const isAdmin = payload?.admin === true;

  return (
    <Router>
      <TokenHandler />
      <Routes>
        {/* --- ROTTE DI LOGIN --- */}
        <Route
          path="/login"
          // ✅ CORREZIONE: Se l'utente ha già un token, lo reindirizza alla dashboard corretta (admin o cliente)
          element={!token ? <Login /> : <Navigate to={isAdmin ? '/admin' : `/dashboard/${payload?.slug}`} replace />}
        />
        <Route
          path="/partner/login"
          element={
            !token ? (
              <PartnerLogin />
            ) : payload?.partner_id ? (
              <Navigate to="/partner/dashboard" replace />
            ) : isAdmin ? (
              <Navigate to="/admin" replace />
            ) : payload?.slug ? (
              <Navigate to={`/dashboard/${payload.slug}`} replace />
            ) : (
              // token esiste ma payload strano → logout soft: torna al login
              <Navigate to="/login" replace />
            )
          }
        />

        {/* --- ROTTE PROTETTE --- */}

        {/* ✅ NUOVA ROTTA DEDICATA PER L'ADMIN */}
        <Route
          path="/admin"
          element={token && isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />}
        />

        {/* La dashboard del CLIENTE, accessibile anche dall'admin */}
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
          element={token && payload?.partner_id ? <PartnerDashboard /> : <Navigate to="/partner/login" replace />}
        />

        {/* --- ROTTA DI DEFAULT / FALLBACK --- */}
        <Route
          path="*"
          element={
            (() => {
              if (!token || !payload) {
                return <Navigate to="/login" replace />;
              }
              // ✅ CORREZIONE: La logica di fallback ora gestisce correttamente i 3 ruoli
              if (isAdmin) {
                return <Navigate to="/admin" replace />;
              }
              if (payload.slug) {
                return <Navigate to={`/dashboard/${payload.slug}`} replace />;
              }
              if (payload.partner_id) {
                return <Navigate to="/partner/dashboard" replace />;
              }
              // Sicurezza: se il token è strano, torna al login
              return <Navigate to="/login" replace />;
            })()
          }
        />
      </Routes>
    </Router>
  );
}