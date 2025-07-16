import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'tailwindcss/version.js': resolve(
        __dirname,
        'src/tailwindcss-version-shim.js',
      ),
      '@eddo/core-shared': resolve(__dirname, '../core-shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10000,
  },
});
