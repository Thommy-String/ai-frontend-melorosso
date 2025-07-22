/// <reference types="node" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Carica .env, .env.<mode>, ecc.
  const env = loadEnv(mode, process.cwd(), '');

  // Filtra solo le VITE_* e ricrea un oggetto
  const viteEnv = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith('VITE_'))
  );

  return {
    plugins: [react()],
    build: {
      lib: {
        entry: 'src/embed.tsx',
        name: 'ChatWidget',
        formats: ['iife'],
        fileName: () => 'widget.iife.js'
      },
      outDir: 'dist-widget',
      rollupOptions: {
        external: ['react-is']
      }
    },
    define: {
      // imposta NODE_ENV
      'process.env.NODE_ENV': JSON.stringify(mode),
      // inietta solo le env VITE_*
      'process.env': viteEnv
    }
  };
});