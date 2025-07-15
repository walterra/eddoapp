import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/*.e2e.test.ts',
      '**/integration-tests/**'
    ],
    testTimeout: 10000,
    projects: [
      {
        name: 'unit',
        test: {
          globals: true,
          environment: 'jsdom',
          include: [
            'packages/web-client/src/**/*.test.tsx',
            'packages/core/src/**/*.test.ts',
            'packages/telegram_bot/src/**/*.test.ts',
            'scripts/backup-interactive.test.ts'
          ],
          exclude: [
            '**/*.e2e.test.ts',
            '**/integration-tests/**'
          ],
          testTimeout: 10000,
        },
      },
      {
        name: 'integration',
        test: {
          globals: true,
          environment: 'node',
          include: ['packages/mcp_server/src/integration-tests/**/*.test.ts'],
          testTimeout: 60000,
        },
      },
      {
        name: 'e2e',
        test: {
          globals: true,
          environment: 'node',
          include: ['scripts/__tests__/e2e/*.e2e.test.ts'],
          testTimeout: 60000,
        },
      },
    ],
  },
});