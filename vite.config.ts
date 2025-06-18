import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Custom plugin to start MCP server during development
function mcpServerPlugin() {
  return {
    name: 'mcp-server',
    configureServer(server: any) {
      server.middlewares.use('/', (req: any, res: any, next: any) => {
        // Only start MCP server on first request to avoid multiple starts
        if (!(globalThis as any).mcpServerStarted) {
          (globalThis as any).mcpServerStarted = true;
          import('./src/mcp-server.js').then(({ startMcpServer }) => {
            startMcpServer();
          }).catch((error: unknown) => {
            console.error('Failed to start MCP server:', error);
          });
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    mcpServerPlugin() // Re-enabled with nano instead of PouchDB
  ],
});
