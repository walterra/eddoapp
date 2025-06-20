import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Custom plugin to start MCP server during development
function mcpServerPlugin() {
  return {
    name: 'mcp-server',
    configureServer(server: any) {
      // Check if MCP server should be loaded (defaults to true)
      const shouldLoadMcp = process.env.VITE_LOAD_MCP !== 'false';
      
      if (!shouldLoadMcp) {
        console.log('MCP server disabled');
        return;
      }
      
      // Start MCP server immediately when Vite dev server starts
      if (!(globalThis as any).mcpServerStarted) {
        (globalThis as any).mcpServerStarted = true;
        import('./packages/server/src/mcp-server.js').then(({ startMcpServer }) => {
          startMcpServer();
        }).catch((error: unknown) => {
          console.error('Failed to start MCP server:', error);
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    mcpServerPlugin()
  ],
  root: './packages/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  }
});