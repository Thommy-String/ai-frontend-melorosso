// App.tsx ------------------------------------------------------------
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Insights from './pages/Insights';  
import ChatWidget   from './ChatWidget';
import { useEffect } from 'react';
import { useState } from 'react';

/* ------ tema per singolo client ----------------------------------- */
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

/* ------ piccolo helper -------------------------------------------- */
function getSlugFromToken(): string | null {
  try {
    const t       = localStorage.getItem('jwt') ?? '';
    const base64  = t.split('.')[1];
    const padded  = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return JSON.parse(atob(padded)).slug ?? null;
  } catch {
    return null;
  }
}

/* ------ wrapper /chat/:slug --------------------------------------- */
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

/* ========================== APP =================================== */
export default function App() {
   const [token, setToken] = useState(() => localStorage.getItem('jwt'));
 const slug = token ? getSlugFromToken() : null;

 // ascolta modifiche a localStorage (login in un’altra tab, logout, …)
 useEffect(() => {
   const onStorage = () => setToken(localStorage.getItem('jwt'));
   window.addEventListener('storage', onStorage);
   return () => window.removeEventListener('storage', onStorage);
 }, []);

  return (
    <Router>
      <Routes>

        {/* login pubblico */}
        <Route path="/login" element={<Login />} />

        {/* dashboard protetta */}
        <Route path="/dashboard/:slug"
               element={ token ? <Dashboard /> : <Navigate to="/login" replace /> } />

        {/* insights protetti  🔸  NEW */}
        <Route path="/insights/:slug"
               element={ token ? <Insights /> : <Navigate to="/login" replace /> } />

        {/* widget protetto */}
        <Route path="/chat/:slug"
               element={ token ? <ChatRoute /> : <Navigate to="/login" replace /> } />

        {/* fallback */}
        <Route path="*"
               element={
                 token && slug
                   ? <Navigate to={`/dashboard/${slug}`} replace />  
                   : <Navigate to="/login" replace />
               }/>

      </Routes>
    </Router>
  );
}