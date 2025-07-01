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
    testTimeout: 45000, // 45 seconds for CouchDB operations (best practice)
    hookTimeout: 15000, // 15 seconds for setup/teardown with database recreation
    setupFiles: ['src/integration-tests/setup/global.ts'],
    reporters: ['verbose'],
    environment: 'node',
    globals: true,

    // Enforce strict sequential execution for database isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true, // Ensure complete isolation between tests
      },
    },
    maxConcurrency: 1, // Only one test at a time

    // Retry failed tests once
    retry: 1,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      MCP_TEST_PORT: process.env.MCP_TEST_PORT || '3003',
      COUCHDB_TEST_DB_NAME: 'todos-test',
      // Allow custom test database URL
      COUCHDB_TEST_URL: process.env.COUCHDB_TEST_URL,
    },

    // Enable debugging to see what's happening
    logLevel: 'verbose',
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
