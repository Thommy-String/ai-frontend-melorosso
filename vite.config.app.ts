// vite.config.app.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // carica .env e .env.<mode>
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',                // usa il tuo index.html in /
    base: '/',                // se vuoi servire da /
    plugins: [react()],
    build: {
      outDir: 'dist-app',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    },
    define: {
      // inietta solo le VITE_*
      'import.meta.env': Object.fromEntries(
        Object.entries(env).filter(([k]) => k.startsWith('VITE_'))
      )
    }
  };
});