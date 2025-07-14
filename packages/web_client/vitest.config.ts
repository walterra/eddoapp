import flowbiteReact from 'flowbite-react/plugin/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [flowbiteReact()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
