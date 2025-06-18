import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Custom plugin to start MCP server during development
function mcpServerPlugin() {
  return {
    name: 'mcp-server',
    configureServer(server) {
      server.middlewares.use('/', (req, res, next) => {
        // Only start MCP server on first request to avoid multiple starts
        if (!global.mcpServerStarted) {
          global.mcpServerStarted = true;
          import('./src/mcp-server.ts').then(({ startMcpServer }) => {
            startMcpServer();
          }).catch(error => {
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
