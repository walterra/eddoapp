import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@eddo/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  root: '.',
  publicDir: false,
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
