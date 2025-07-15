import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.PORT || '5173'),
      host: '0.0.0.0',
    },
    build: {
      outDir: '../web-api/public',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@eddo/core': resolve(__dirname, '../core/src'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
  };
});
