import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

/* ---------------------------------------------------- */
/*  JWT helper (base64url → JSON)                       */
/* ---------------------------------------------------- */
function parseJwt(token: string) {
  try {
    const [, payload] = token.split('.');
    const padded  = payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '=');
    const base64  = padded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/* ==================================================== */
export default function Login() {
  const nav = useNavigate();

  const [email,     setEmail]    = useState('');
  const [password,  setPwd]      = useState('');
  const [loading,   setLoad]     = useState(false);
  const [errMsg,    setErr]      = useState('');

  /* -------------------------------------------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoad(true);

    try {
      const res = await fetch(
        'https://ai-backend-melorosso.onrender.com/auth/login',
        {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ email, password })
        }
      );

      const { token, error } = await res.json();
      if (!res.ok) throw new Error(error || 'Credenziali non valide');

      localStorage.setItem('jwt', token);

      /* ---------- slug dal JWT ---------- */
      const payload = parseJwt(token);
      const slug    = payload?.slug as string | undefined;
      console.log('[login] decoded slug ⇒', slug);

      if (!slug) throw new Error('Token privo di slug');

      /* ---------- redirect dashboard ---- */
      window.location.replace(`${window.location.origin}/#/dashboard/${slug}`);

    } catch (e) {
      setErr((e as Error).message || 'Errore di autenticazione');
    } finally {
      setLoad(false);
    }
  };

  /* -------------------------------------------------- */
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
          <div>
            <label htmlFor="email" className="login-label">Email</label>
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
          </div>

          <div>
            <label htmlFor="password" className="login-label">Password</label>
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