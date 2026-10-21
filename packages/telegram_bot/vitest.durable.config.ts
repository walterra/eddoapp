import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [tsconfigPaths()],
  test: {
    name: 'telegram-durable-integration',
    environment: 'node',
    include: ['packages/telegram_bot/src/integration-tests/durable/**/*.test.ts'],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    globalSetup: ['test/integration-global-setup.ts'],
    setupFiles: ['test/durable_env_setup.ts'],
  },
});
