/**
 * Vitest global setup for telegram-bot integration tests
 * Global configuration and utilities for all tests
 */
// Make environment variables available for tests
import { beforeAll } from 'vitest';

beforeAll(() => {
  // Ensure test environment is properly configured
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  // Set default timeout for tests
  if (!process.env.VITEST_TIMEOUT) {
    process.env.VITEST_TIMEOUT = '45000';
  }
});
