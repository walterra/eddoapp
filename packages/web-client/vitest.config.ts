import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'tailwindcss/version.js': resolve(
        __dirname,
        'src/tailwindcss-version-shim.js',
      ),
      '@eddo/core': resolve(__dirname, '../core/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10000,
  },
});
