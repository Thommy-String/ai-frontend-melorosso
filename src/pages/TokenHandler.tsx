// src/TokenHandler.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function TokenHandler() {
  const { setToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const impersonationToken = params.get('impersonation_token');

    if (impersonationToken) {
      // ✅ CORREZIONE: Imposta il token SENZA salvarlo nel localStorage
      setToken(impersonationToken, false); 
      
      const cleanPath = location.pathname + location.hash.split('?')[0];
      navigate(cleanPath, { replace: true });
    }
  }, [setToken, location, navigate]);

  return null;
}