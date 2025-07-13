import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionState, MCPConnectionManager } from './connection-manager.js';

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn().mockResolvedValue({
      tools: [{ name: 'test-tool', description: 'Test tool', inputSchema: {} }],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: { result: 'success' },
    }),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

vi.mock('../utils/config.js', () => ({
  appConfig: {
    MCP_SERVER_URL: 'http://localhost:3000',
    MCP_API_KEY: 'test-key',
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCPConnectionManager', () => {
  let manager: MCPConnectionManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    manager = new MCPConnectionManager();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await manager.close();
  });

  describe('Connection Lifecycle', () => {
    it('should start in disconnected state', () => {
      expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should establish connection successfully', async () => {
      await manager.initialize();

      expect(manager.getState()).toBe(ConnectionState.CONNECTED);
      const metrics = manager.getMetrics();
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.connectAttempts).toBe(1);
    });

    it('should return existing connection if already connected', async () => {
      await manager.initialize();
      const firstMetrics = manager.getMetrics();

      await manager.initialize();
      const secondMetrics = manager.getMetrics();

      expect(secondMetrics.connectAttempts).toBe(firstMetrics.connectAttempts);
    });

    it('should handle connection failure', async () => {
      const { Client } = await import(
        '@modelcontextprotocol/sdk/client/index.js'
      );
      // @ts-expect-error - Mocking external SDK for testing purposes
      vi.mocked(Client).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      }));

      await expect(manager.initialize()).rejects.toThrow('Connection refused');
      expect(manager.getState()).toBe(ConnectionState.FAILED);

      const metrics = manager.getMetrics();
      expect(metrics.failedConnections).toBe(1);
    });
  });

  describe('Tool Discovery', () => {
    it('should discover tools on connection', async () => {
      await manager.initialize();

      const tools = manager.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: {},
      });
    });
  });

  describe('Tool Invocation', () => {
    it('should invoke tools successfully', async () => {
      await manager.initialize();

      const result = await manager.invoke('test-tool', { param: 'value' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should throw error when invoking tools while disconnected', async () => {
      await expect(
        manager.invoke('test-tool', { param: 'value' }),
      ).rejects.toThrow('Cannot invoke tool: connection state is DISCONNECTED');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should perform health checks periodically', async () => {
      const { Client } = await import(
        '@modelcontextprotocol/sdk/client/index.js'
      );
      const mockClient = vi.mocked(Client);

      await manager.initialize();

      // Clear previous calls
      const instance = mockClient.mock.results[0].value;
      vi.mocked(instance.listTools).mockClear();

      // Advance time to trigger health check
      vi.advanceTimersByTime(30000);

      // Health check should call listTools
      expect(instance.listTools).toHaveBeenCalled();
    });
  });

  describe('Metrics Tracking', () => {
    it('should track connection metrics', async () => {
      await manager.initialize();

      const metrics = manager.getMetrics();
      expect(metrics.connectAttempts).toBe(1);
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.failedConnections).toBe(0);
      expect(metrics.lastConnectionTime).toBeDefined();
      expect(metrics.totalUptime).toBeGreaterThanOrEqual(0);
    });

    it('should update uptime on close', async () => {
      await manager.initialize();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      await manager.close();

      const metrics = manager.getMetrics();
      expect(metrics.totalUptime).toBeGreaterThan(0);
      expect(metrics.currentSessionStart).toBeUndefined();
    });
  });

  describe('Connection State Management', () => {
    it('should handle concurrent operations gracefully', async () => {
      // Start multiple initialize calls concurrently
      const promises = [
        manager.initialize(),
        manager.initialize(),
        manager.initialize(),
      ];

      await Promise.all(promises);

      // Should only connect once
      const metrics = manager.getMetrics();
      expect(metrics.connectAttempts).toBe(1);
      expect(manager.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should clean up resources on close', async () => {
      await manager.initialize();
      await manager.close();

      expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(manager.getTools()).toHaveLength(0);
    });
  });

  describe('Error Classification', () => {
    it('should identify connection errors correctly', async () => {
      const { Client } = await import(
        '@modelcontextprotocol/sdk/client/index.js'
      );
      const mockClient = vi.mocked(Client);

      await manager.initialize();

      const instance = mockClient.mock.results[0].value;

      // Test a connection error
      vi.mocked(instance.callTool).mockRejectedValueOnce(
        new Error('ECONNREFUSED'),
      );

      await expect(manager.invoke('test-tool', {})).rejects.toThrow(
        'ECONNREFUSED',
      );
    });
  });
});
