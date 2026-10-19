import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/integration-tests/backup_restore.test.ts'],
    hookTimeout: 120000,
    testTimeout: 60000,
    fileParallelism: false,
  },
});
