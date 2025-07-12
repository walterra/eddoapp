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
    globalSetup: ['src/integration-tests/setup/global-setup.ts'],
    setupFiles: ['src/integration-tests/setup/global.ts'],
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid database conflicts
        isolate: true, // Ensure complete isolation between tests
      },
    },
    maxConcurrency: 1, // Only one test at a time
    coverage: {
      enabled: false, // Disable coverage for integration tests
    },
    // Retry failed tests once
    retry: 1,
    // Show detailed output
    reporter: 'verbose',
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      MCP_TEST_PORT: process.env.MCP_TEST_PORT || '3003',
      COUCHDB_TEST_DB_NAME: 'todos-test',
      // Allow custom test database URL
      COUCHDB_TEST_URL: process.env.COUCHDB_TEST_URL,
    },
  },
});
