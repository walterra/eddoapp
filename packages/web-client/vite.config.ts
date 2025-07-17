import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.PORT || '5173'),
      host: '0.0.0.0',
      hmr: {
        port: 5173,
        host: 'localhost',
      },
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
        '@eddo/core-client': resolve(__dirname, '../core-client/src'),
        '@eddo/core-server': resolve(__dirname, '../core-server/src'),
        '@eddo/core-shared': resolve(__dirname, '../core-shared/src'),
        'tailwindcss/version.js': resolve(
          __dirname,
          'src/tailwindcss-version-shim.js',
        ),
      },
    },
    css: {
      postcss: '../../postcss.config.cjs',
    },
  };
});
