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
        entry: 'src/index.ts',
        exclude: [
          // Remove TypeScript/TSX exclusion to allow Vite to handle them
          /.*\.(s?css|less)($|\?)/,
          /.*\.(svg|png|jpg|jpeg|gif|webp)($|\?)/,
          /^\/@.+$/,
          /^\/favicon\.ico$/,
          /^\/(public|assets|static)\/.+/,
          /^\/node_modules\/.*/,
        ],
        injectClientScript: false,
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
        '@eddo/web-client': resolve(__dirname, '../web_client/src'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
  };
});
