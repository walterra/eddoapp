import react from '@vitejs/plugin-react';
import { config } from 'dotenv';
import flowbiteReact from 'flowbite-react/plugin/vite';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// Load environment variables from the root .env file
config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig(({ mode }) => {
  const _env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), flowbiteReact()],
    resolve: {
      alias: {
        '@eddo/core': path.resolve(__dirname, '../core/src'),
      },
    },
    root: '.',
    publicDir: false,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/auth': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development',
      ),
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'info'),
      // Production API endpoint for web server
      'process.env.API_URL': JSON.stringify(
        process.env.API_URL || 'http://localhost:3000/api',
      ),
    },
  };
});
