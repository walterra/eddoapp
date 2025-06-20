import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@eddo/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  root: '.',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  }
});