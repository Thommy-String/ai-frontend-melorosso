import { createContext, useState, useContext, ReactNode, useMemo } from 'react';

interface AuthContextType {
  /** Token usato per ADMIN/CLIENT (o impersonation se attiva) */
  token: string | null; // alias di effectiveUserToken
  setToken: (newToken: string | null, persist?: boolean) => void; // alias di setUserToken

  /** Token persistente per ADMIN/CLIENT */
  userToken: string | null;
  setUserToken: (newToken: string | null, persist?: boolean) => void;

  /** Token separato per PARTNER */
  partnerToken: string | null;
  setPartnerToken: (newToken: string | null, persist?: boolean) => void;

  /** Token di IMPERSONAZIONE (solo in memoria) */
  impersonationToken: string | null;
  setImpersonationToken: (newToken: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Persistenza
  const [userToken, setUserTokenState] = useState<string | null>(() => {
    try { return localStorage.getItem('jwt'); } catch { return null; }
  });
  const [partnerToken, setPartnerTokenState] = useState<string | null>(() => {
    try { return localStorage.getItem('partner_token'); } catch { return null; }
  });

  // Solo memoria (non persistente)
  const [impersonationToken, setImpersonationTokenState] = useState<string | null>(null);

  const setUserToken = (newToken: string | null, persist: boolean = true) => {
    setUserTokenState(newToken);
    try {
      if (persist) {
        if (newToken) {
          localStorage.setItem('jwt', newToken);
          sessionStorage.setItem('jwt', newToken);
        } else {
          localStorage.removeItem('jwt');
          sessionStorage.removeItem('jwt');
        }
      }
    } catch {}
  };

  const setPartnerToken = (newToken: string | null, persist: boolean = true) => {
    setPartnerTokenState(newToken);
    try {
      if (persist) {
        if (newToken) {
          localStorage.setItem('partner_token', newToken);
        } else {
          localStorage.removeItem('partner_token');
        }
      }
    } catch {}
  };

  const setImpersonationToken = (newToken: string | null) => {
    setImpersonationTokenState(newToken); // mai su storage
  };

  // Token effettivo usato per admin/client: se c'è impersonation, prevale
  const effectiveUserToken = impersonationToken ?? userToken;

  // Back-compat alias
  const token = effectiveUserToken;
  const setToken = setUserToken;

  const contextValue = useMemo(
    () => ({
      token,
      setToken,
      userToken,
      setUserToken,
      partnerToken,
      setPartnerToken,
      impersonationToken,
      setImpersonationToken,
    }),
    [token, userToken, partnerToken, impersonationToken]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}