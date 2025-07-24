// src/main.tsx  (o index.tsx)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import App from './App';
import { AuthProvider } from './AuthContext';   // ⬅️  nuovo import
import { setApiBase } from './api/api';

setApiBase('https://ai-backend-melorosso.onrender.com');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ⬇️ avvolgi qui */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);