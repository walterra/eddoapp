import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [tsconfigPaths()],
  test: {
    name: 'telegram-bot-integration',
    include: ['packages/telegram_bot/src/integration-tests/**/*.test.ts'],
    exclude: ['**/*.unit.test.ts', '**/integration-tests/durable/**'],
    testTimeout: 60000, // 1 minute timeout for integration tests
    hookTimeout: 30000, // 30 second timeout for setup/teardown
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid database conflicts
      },
    },
    setupFiles: ['packages/telegram_bot/src/integration-tests/setup/vcr-env-setup.ts'],
    coverage: {
      enabled: false, // Disable coverage for integration tests
    },
    // Retry failed tests once
    retry: 0,
    // Show detailed output
    reporter: 'verbose',
  },
});
