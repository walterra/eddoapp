import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: './packages/web_server',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    include: ['@eddo/core']
  },
  ssr: {
    noExternal: ['@eddo/core']
  }
});