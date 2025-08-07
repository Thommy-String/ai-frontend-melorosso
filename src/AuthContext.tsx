// src/AuthContext.tsx
import { createContext, useState, useContext, ReactNode, useMemo } from 'react';

interface AuthContextType {
  token: string | null;
  // Aggiungi il secondo parametro opzionale 'persist' alla definizione
  setToken: (newToken: string | null, persist?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Leggi il token iniziale dal localStorage
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('jwt'));

  // Funzione per impostare il token e salvarlo nel localStorage
  const setToken = (newToken: string | null, persist: boolean = true) => {
    setTokenState(newToken); setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('jwt', newToken);
      sessionStorage.setItem('jwt', newToken); // Opzionale, come facevi tu
    } else {
      localStorage.removeItem('jwt');
      sessionStorage.removeItem('jwt');
    }
  };

  // useMemo per evitare ricalcoli inutili
  const contextValue = useMemo(() => ({ token, setToken }), [token]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizzato per usare facilmente il contesto
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}