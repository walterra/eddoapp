import devServer from '@hono/vite-dev-server';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (mode === 'client') {
    return {
      plugins: [react()],
      build: {
        rollupOptions: {
          input: ['./src/client.tsx'],
          output: {
            entryFileNames: 'static/client.js',
            chunkFileNames: 'static/assets/[name]-[hash].js',
            assetFileNames: 'static/assets/[name].[ext]',
          },
        },
        emptyOutDir: false,
        copyPublicDir: false,
      },
      resolve: {
        alias: {
          '@eddo/core': resolve(__dirname, '../core/src'),
        },
      },
    };
  } else {
    return {
      plugins: [
        react(),
        devServer({
          entry: 'src/server/index.ts',
          exclude: [
            /.*\.(s?css|less)($|\?)/,
            /.*\.(svg|png|jpg|jpeg|gif|webp)($|\?)/,
            /^\/@.+$/,
            /^\/favicon\.ico$/,
            /^\/(public|assets|static)\/.+/,
            /^\/node_modules\/.*/,
          ],
          injectClientScript: true,
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
  }
});
