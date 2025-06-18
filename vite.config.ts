import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Custom plugin to start MCP server during development
function mcpServerPlugin() {
  return {
    name: 'mcp-server',
    configureServer() {
      // Import and start MCP server when Vite dev server starts
      import('./src/mcp-server.js').then(({ startMcpServer }) => {
        startMcpServer();
      }).catch(error => {
        console.error('Failed to start MCP server:', error);
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    mcpServerPlugin() // Add MCP server plugin
  ],
});
