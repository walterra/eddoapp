import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'telegram-durable-integration',
    environment: 'node',
    include: ['packages/telegram_bot/src/integration-tests/durable/**/*.test.ts'],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
