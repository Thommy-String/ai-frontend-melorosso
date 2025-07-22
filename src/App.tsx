// src/App.tsx
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import ChatWidget from './ChatWidget';     // il componente white-label

/* ---------- helper: sceglie look per slug ------------------ */
const brand = (slug:string) => {
  switch (slug) {
    case 'barilla': return {
      accent : '#0057B7',
      logoUrl: 'https://www.barilla.com/favicon.ico',
      start  : 'Chiedimi tutto su Barilla…'
    };
    case 'custom-light-garage': return {
      accent : '#FF4E00',
      logoUrl: '/clg_logo.svg',
      start  : 'Cosa vuoi illuminare oggi?'
    };
    default: return {
      accent : '#3b82f6',
      logoUrl: '/bot.png',
      start  : 'Scrivi…'
    };
  }
};

/* ---------- wrapper rotta /chat/:slug ----------------------- */
function ChatRoute() {
  const { slug = 'barilla' } = useParams();      // fallback
  const { accent, logoUrl, start } = brand(slug);
  return (
    <ChatWidget
      slug={slug}
      accent={accent}
      logoUrl={logoUrl}
      startText={start}
      floating={false}          // o true se vuoi la bolla
    />
  );
}

/* ====================== App ================================ */
export default function App() {
  const token = localStorage.getItem('jwt');      // auth molto semplice

  return (
    <Router>
      <Routes>

        <Route path="/login" element={<Login />} />

         <Route path="/dashboard/:slug"
        element={ token ? <Dashboard/> : <Navigate to="/login" replace/> } />

        {/*  ⚡️ multi-cliente: /#/chat/barilla oppure /#/chat/custom-light-garage  */}
        <Route path="/chat/:slug"
               element={ token ? <ChatRoute/> : <Navigate to="/login" replace/> } />

        {/* fallback */}
        <Route path="*"
               element={<Navigate to={ token ? '/dashboard' : '/login' } replace/>}/>
      </Routes>
    </Router>
  );
}