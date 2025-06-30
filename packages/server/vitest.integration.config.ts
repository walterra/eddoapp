/**
 * Vitest configuration for MCP integration tests
 */
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mcp-integration',
    include: ['src/integration-tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    setupFiles: ['src/integration-tests/setup/global.ts'],
    reporters: ['verbose'],
    environment: 'node',
    globals: true,

    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Retry failed tests once
    retry: 1,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      MCP_TEST_URL: 'http://localhost:3003/mcp',
      COUCHDB_DB_NAME: 'todos-test',
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  esbuild: {
    target: 'node18',
  },
});
