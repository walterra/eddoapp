import devServer from '@hono/vite-dev-server';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      devServer({
        entry: 'src/index.ts',
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
  };
});
