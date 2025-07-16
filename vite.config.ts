import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import flowbiteReact from "flowbite-react/plugin/vite";

export default defineConfig({
  plugins: [react(), flowbiteReact()],
  root: './packages/web-client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    include: ['@eddo/core-shared', '@eddo/core-client']
  },
  ssr: {
    noExternal: ['@eddo/core-shared', '@eddo/core-client']
  }
});