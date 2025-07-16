import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { Plugin, defineConfig, loadEnv } from 'vite';

// Custom plugin to handle the tailwindcss/version.js import issue
function tailwindVersionPlugin(): Plugin {
  return {
    name: 'tailwind-version-plugin',
    resolveId(id: string) {
      if (id === 'tailwindcss/version.js') {
        return id;
      }
    },
    load(id: string) {
      if (id === 'tailwindcss/version.js') {
        return 'export const version = "3.4.17"; export default version;';
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindVersionPlugin()],
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
        external: ['tailwindcss/version.js'],
      },
    },
    resolve: {
      alias: {
        '@eddo/core': resolve(__dirname, '../core/src'),
        'tailwindcss/version.js': resolve(
          __dirname,
          'src/tailwindcss-version-shim.js',
        ),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
  };
});
