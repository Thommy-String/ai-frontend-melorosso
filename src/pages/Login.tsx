import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';



function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(
        'https://ai-backend-melorosso.onrender.com/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenziali non valide');
      const { token } = data;
      localStorage.setItem('jwt', token);

      // Estrai slug dal JWT e redirigi
      const payload = parseJwt(token);
      const slug = payload?.slug || '';
      navigate(`/dashboard/${slug}`, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Errore di autenticazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img
            src='https://file.aiquickdraw.com/imgcompressed/img/compressed_01209031180c636cc1d733567956e414.webp'
            alt="Logo"
            className="login-logo"
          />
        </div>
        <h2 className="login-title">Accedi a Melorosso</h2>
        <p className="login-desc">Inserisci le credenziali fornite da Melorosso</p>
        {error && (
          <div className="login-error">
            {/* Se vuoi puoi aggiungere un’icona SVG di errore qui */}
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="login-form">
          <div>
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              placeholder="tuo@esempio.com"
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              placeholder="Password"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}