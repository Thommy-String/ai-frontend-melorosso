// App.tsx ------------------------------------------------------------
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Insights   from './pages/Insights';
import ChatWidget from './ChatWidget';

/* ---------- tema per singolo client ------------------------------ */
const brand = (slug: string) => ({
  barilla: {
    accent : '#0057B7',
    logoUrl: 'https://www.barilla.com/favicon.ico',
    start  : 'Chiedimi tutto su Barilla…'
  },
  'custom-light-garage': {
    accent : '#FF4E00',
    logoUrl: '/clg_logo.svg',
    start  : 'Cosa vuoi illuminare oggi?'
  }
}[slug] ?? {
  accent : '#3b82f6',
  logoUrl: '/bot.png',
  start  : 'Scrivi…'
});

/* ---------- helper: slug dal JWT --------------------------------- */
function getSlugFromToken(tok?: string | null): string | null {
  if (!tok) return null;
  try {
    const [, p]   = tok.split('.');
    const padded  = p.padEnd(p.length + (4 - p.length % 4) % 4, '=');
    return JSON.parse(atob(padded)).slug ?? null;
  } catch {
    return null;
  }
}

/* ---------- wrapper /chat/:slug ---------------------------------- */
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
  /* Leggiamo il token al **render corrente**: se la Login l’ha appena
     scritto, qui lo vediamo subito senza need di reload                       */
  const token = localStorage.getItem('jwt') || sessionStorage.getItem('jwt');
  const slug  = getSlugFromToken(token);

  return (
    <Router>
      <Routes>
        {/* login pubblico */}
        <Route path="/login" element={<Login />} />

        {/* dashboard protetta */}
        <Route
          path="/dashboard/:slug"
          element={ token ? <Dashboard /> : <Navigate to="/login" replace /> }
        />

        {/* insights protetti */}
        <Route
          path="/insights/:slug"
          element={ token ? <Insights /> : <Navigate to="/login" replace /> }
        />

        {/* widget protetto */}
        <Route
          path="/chat/:slug"
          element={ token ? <ChatRoute /> : <Navigate to="/login" replace /> }
        />

        {/* fallback */}
        <Route
          path="*"
          element={
            token && slug
              ? <Navigate to={`/dashboard/${slug}`} replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}