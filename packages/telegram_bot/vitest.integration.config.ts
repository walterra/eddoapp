import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'telegram-bot-integration',
    include: ['src/integration-tests/**/*.test.ts'],
    exclude: ['src/**/*.unit.test.ts'],
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
    setupFiles: [],
    coverage: {
      enabled: false, // Disable coverage for integration tests
    },
    // Retry failed tests once
    retry: 1,
    // Show detailed output
    reporter: 'verbose',
  },
});
