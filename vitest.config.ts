import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'tailwindcss/version.js': resolve(
        __dirname,
        'packages/web-client/src/tailwindcss-version-shim.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: [
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['**/*.e2e.test.ts', '**/integration-tests/**'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    projects: [
      {
        name: 'unit',
        resolve: {
          alias: {
            'tailwindcss/version.js': resolve(
              __dirname,
              'packages/web-client/src/tailwindcss-version-shim.js',
            ),
            '@eddo/core-client': resolve(__dirname, 'packages/core-client/src'),
            '@eddo/core-server': resolve(__dirname, 'packages/core-server/src'),
            '@eddo/core-shared': resolve(__dirname, 'packages/core-shared/src'),
          },
        },
        test: {
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./test/setup.js'],
          include: [
            'packages/web-client/src/**/*.test.{ts,tsx}',
            'packages/web-api/src/**/*.test.ts',
            'packages/core-shared/src/**/*.test.ts',
            'packages/core-server/src/**/*.test.ts',
            'packages/core-client/src/**/*.test.ts',
            'packages/telegram_bot/src/**/*.test.ts',
            'scripts/backup-interactive.test.ts',
            'scripts/backup-retention.test.ts',
            'scripts/backup-scheduler.test.ts',
            'scripts/create-release-pr.test.js',
          ],
          exclude: ['**/*.e2e.test.ts', '**/integration-tests/**'],
          testTimeout: 10000,
        },
      },
      {
        name: 'integration',
        resolve: {
          alias: {
            'tailwindcss/version.js': resolve(
              __dirname,
              'packages/web-client/src/tailwindcss-version-shim.js',
            ),
            '@eddo/core-client': resolve(__dirname, 'packages/core-client/src'),
            '@eddo/core-server': resolve(__dirname, 'packages/core-server/src'),
            '@eddo/core-shared': resolve(__dirname, 'packages/core-shared/src'),
          },
        },
        test: {
          globals: true,
          environment: 'node',
          include: ['packages/mcp_server/src/integration-tests/**/*.test.ts'],
          testTimeout: 60000,
        },
      },
      {
        name: 'e2e',
        resolve: {
          alias: {
            'tailwindcss/version.js': resolve(
              __dirname,
              'packages/web-client/src/tailwindcss-version-shim.js',
            ),
            '@eddo/core-client': resolve(__dirname, 'packages/core-client/src'),
            '@eddo/core-server': resolve(__dirname, 'packages/core-server/src'),
            '@eddo/core-shared': resolve(__dirname, 'packages/core-shared/src'),
          },
        },
        test: {
          globals: true,
          environment: 'node',
          globalSetup: ['./test/e2e-global-setup.ts'],
          setupFiles: ['./test/e2e-setup.js'],
          include: ['scripts/__tests__/e2e/*.e2e.test.ts'],
          testTimeout: 60000,
        },
      },
    ],
  },
});
