/**
 * Server Startup Integration Test
 * Verifies that the MCP server starts correctly and is accessible
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MCPTestServer } from '../setup/test-server.js';

describe('MCP Server Startup Integration', () => {
  let testServer: MCPTestServer;

  beforeEach(async () => {
    testServer = new MCPTestServer();
    await testServer.waitForServer();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('Server Connectivity', () => {
    it('should successfully connect to the test MCP server', async () => {
      // The fact that beforeEach succeeded means the server is running
      expect(testServer.getClient()).toBeDefined();
    });

    it('should be able to list available tools', async () => {
      const tools = await testServer.listAvailableTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      // Verify we have the expected tools
      const toolNames = tools.map((tool) => tool.name);
      expect(toolNames).toContain('createTodo');
      expect(toolNames).toContain('listTodos');
      expect(toolNames).toContain('getServerInfo');
    });

    it('should successfully call getServerInfo tool', async () => {
      const serverInfo = await testServer.callTool('getServerInfo', {
        section: 'overview',
      });

      expect(typeof serverInfo).toBe('string');
      expect(serverInfo).toContain('Eddo MCP Server Overview');
    });

    it('should be using isolated test environment', async () => {
      // Verify test environment variables are set correctly
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.COUCHDB_DB_NAME).toBe('todos-test');
    });

    it('should start with empty test database', async () => {
      const todos = await testServer.callTool('listTodos', {});

      // Should be empty array or empty string indicating no todos
      if (Array.isArray(todos)) {
        expect(todos).toHaveLength(0);
      } else if (typeof todos === 'string') {
        // If returned as JSON string, parse and check
        const parsedTodos = JSON.parse(todos);
        expect(Array.isArray(parsedTodos)).toBe(true);
        expect(parsedTodos).toHaveLength(0);
      }
    });
  });
});
