import react from '@vitejs/plugin-react';
import flowbiteReact from 'flowbite-react/plugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), flowbiteReact()],
  root: './packages/web-client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['@eddo/core-shared', '@eddo/core-client'],
  },
  ssr: {
    noExternal: ['@eddo/core-shared', '@eddo/core-client'],
  },
});
