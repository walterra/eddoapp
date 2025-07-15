import devServer from '@hono/vite-dev-server';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      devServer({
        entry: 'src/server/index.ts',
      }),
    ],
    server: {
      port: parseInt(env.PORT || '3000'),
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
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
