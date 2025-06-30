import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: './packages/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    include: ['@eddo/shared']
  },
  ssr: {
    noExternal: ['@eddo/shared']
  }
});