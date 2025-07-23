import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

/* -------------------------------------------------------------- */
/*  helper: decode JWT (parte payload)                            */
/* -------------------------------------------------------------- */
function parseJwt(token: string) {
  try {
    const payload = token.split('.')[1];              // parte centrale
    const padded  = payload.padEnd(
      payload.length + (4 - (payload.length % 4)) % 4,
      '='
    );                                                // aggiungi padding =
    const base64  = padded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/* =============================================================== */
export default function Login() {
  const nav = useNavigate();

  /* stato form */
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');

  /* -------------------------------------------------------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch(
        'https://ai-backend-melorosso.onrender.com/auth/login',
        {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ email, password })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenziali non valide');

      const { token } = data as { token: string };
      localStorage.setItem('jwt', token);

      const slug = parseJwt(token)?.slug;
      if (!slug) throw new Error('Token non valido');

      /* redirect assoluto (con / all’inizio) */
      nav(`/dashboard/${slug}`, { replace: true });

    } catch (err) {
      setErrorMsg((err as Error).message || 'Errore di autenticazione');
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------- */
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

        {errorMsg && <div className="login-error">{errorMsg}</div>}

        <form onSubmit={onSubmit} className="login-form">
          <div>
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="login-input"
              placeholder="tuo@esempio.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}