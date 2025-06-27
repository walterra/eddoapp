import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { config } from 'dotenv';

// Load environment variables from the root .env file
config({ path: path.resolve(__dirname, '../../.env') });

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
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.COUCHDB_URL': JSON.stringify(process.env.COUCHDB_URL || 'http://admin:password@localhost:5984'),
    'process.env.COUCHDB_DB_NAME': JSON.stringify(process.env.COUCHDB_DB_NAME || 'todos-dev'),
    'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'info'),
  },
});
