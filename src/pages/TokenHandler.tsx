// src/pages/TokenHandler.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function TokenHandler() {
  const { setImpersonationToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const impersonationToken = params.get('impersonation_token');

    if (impersonationToken) {
      // Token di impersonazione: SOLO in memoria, nessuna persistenza
      setImpersonationToken(impersonationToken);

      // Pulisce la query mantenendo hash route
      const cleanHash = location.hash.split('?')[0] || '#/';
      navigate({ pathname: location.pathname, hash: cleanHash }, { replace: true });
    }
  }, [location.search]);

  return null;
}