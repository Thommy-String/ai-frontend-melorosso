// src/pages/Login.tsx
import { useState } from 'react';
import { useAuth } from '../AuthContext';   // ⬅️  contesto
import { loginUser } from '../api/api';
import './Login.css';

/* ----------------------------- JWT helper ----------------------------- */


/* ===================================================================== */
export default function Login() {
  const { setToken }      = useAuth();           // funzione reattiva
  const [email, setEmail] = useState('');
  const [password, setPwd]= useState('');
  const [loading, setLoad]= useState(false);
  const [errMsg,  setErr] = useState('');

  /* ---------------------------- submit -------------------------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoad(true);

    try {
      // ✅ Usa la funzione centralizzata da api.ts
      const { token } = await loginUser(email, password);
      setToken(token); // Imposta il token, il redirect avverrà automaticamente in App.tsx
    } catch (e) {
      setErr((e as Error).message || 'Errore di autenticazione');
      setLoad(false);
    }
    // Non c'è bisogno di un else o finally, il redirect gestirà il resto.
  }

  /* ----------------------------- UI ----------------------------------- */
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img
            src="https://file.aiquickdraw.com/imgcompressed/img/compressed_01209031180c636cc1d733567956e414.webp"
            alt="Logo"
            className="login-logo"
          />
        </div>

        <h2 className="login-title">Accedi a Melorosso</h2>
        <p className="login-desc">Inserisci le credenziali fornite da Melorosso</p>

        {errMsg && <div className="login-error">{errMsg}</div>}

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="login-input"
            placeholder="tuo@esempio.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <label className="login-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={e => setPwd(e.target.value)}
            required
            disabled={loading}
          />

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
} 