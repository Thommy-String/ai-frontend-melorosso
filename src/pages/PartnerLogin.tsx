// src/pages/PartnerLogin.tsx
import { useState } from 'react';
import { useAuth } from '../AuthContext';
import './Login.css'; // Puoi riutilizzare lo stesso CSS

// ✅ Helper JWT aggiornato per gestire sia partner che clienti
function parsePartnerJwt(token: string) {
  try {
    const [, payload] = token.split('.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function PartnerLogin() {
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPwd] = useState('');
  const [loading, setLoad] = useState(false);
  const [errMsg, setErr] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoad(true);

    try {
      // ✅ 1. Endpoint modificato per il login dei partner
      const res = await fetch(
        'https://ai-backend-melorosso.onrender.com/api/partners/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        }
      );

      const { token, error } = await res.json();
      if (!res.ok) throw new Error(error || 'Credenziali non valide');

      // ✅ 2. Controlliamo il payload del token del partner
      const payload = parsePartnerJwt(token);
      if (!payload?.partner_id) throw new Error('Token non valido per un partner');

      setToken(token);

    } catch (e) {
      setErr((e as Error).message || 'Errore di autenticazione');
      setLoad(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        {/* Puoi personalizzare titoli e descrizioni per i partner */}
        <h2 className="login-title">Accesso Area Partner</h2>
        <p className="login-desc">Inserisci le tue credenziali per accedere alla dashboard</p>

        {errMsg && <div className="login-error">{errMsg}</div>}

        <form onSubmit={onSubmit} className="login-form">
          {/* ... il resto del form è identico ... */}
          <label className="login-label" htmlFor="email">Email</label>
          <input id="email" type="email" /* ... */ />
          <label className="login-label" htmlFor="password">Password</label>
          <input id="password" type="password" /* ... */ />
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}