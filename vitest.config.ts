import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    projects: [
      'packages/client',
      'packages/shared',
      {
        test: {
          globals: true,
          environment: 'node',
          include: ['scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          testTimeout: 60000,
        },
      },
    ],
  },
});