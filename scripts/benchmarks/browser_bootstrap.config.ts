import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'pouchdb-find': resolve(
        'packages/web-client/node_modules/pouchdb-find/lib/index-browser.es.js',
      ),
    },
  },
  build: {
    outDir: 'benchmark-results/bootstrap',
    emptyOutDir: true,
    lib: {
      entry: resolve('scripts/benchmarks/browser_bootstrap.ts'),
      name: 'EddoBenchmarkBootstrap',
      formats: ['iife'],
      fileName: () => 'bootstrap.js',
    },
  },
});
