import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { MCPTool } from './client.js';
import {
  calculateReconnectDelay,
  isConnectionError as checkIsConnectionError,
  createUserClient,
  invokeToolOnClient,
} from './connection-manager-helpers.js';
import type { MCPUserContext } from './user-context.js';

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  FAILED = 'FAILED',
}

export interface ConnectionMetrics {
  connectAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime?: Date;
  lastDisconnectionTime?: Date;
  totalUptime: number; // in milliseconds
  currentSessionStart?: Date;
}

export class MCPConnectionManager {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private tools: MCPTool[] = [];
  private metrics: ConnectionMetrics = {
    connectAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalUptime: 0,
  };

  // Reconnection configuration
  private readonly maxReconnectAttempts = 5;
  private reconnectAttempt = 0;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds
  private readonly initialReconnectDelayMs = 1000; // 1 second
  private readonly maxReconnectDelayMs = 60000; // 60 seconds

  constructor() {
    logger.info('MCPConnectionManager initialized');
  }

  /** Get current connection state */
  getState(): ConnectionState {
    return this.state;
  }

  /** Get connection metrics */
  getMetrics(): ConnectionMetrics {
    // Update total uptime if currently connected
    if (this.state === ConnectionState.CONNECTED && this.metrics.currentSessionStart) {
      const sessionUptime = Date.now() - this.metrics.currentSessionStart.getTime();
      return {
        ...this.metrics,
        totalUptime: this.metrics.totalUptime + sessionUptime,
      };
    }
    return { ...this.metrics };
  }

  /** Initialize connection with proper handshake */
  async initialize(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED) {
      logger.info('Already connected, skipping initialization');
      return;
    }

    if (this.state === ConnectionState.CONNECTING) {
      logger.warn('Connection already in progress');
      return;
    }

    try {
      await this.establishConnection();
      this.startHealthCheck();
    } catch (error) {
      logger.error('Failed to initialize MCP connection', {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Establish connection to MCP server
   * Note: This creates a base connection without user-specific authentication.
   * User authentication is handled per-request via headers in tool calls.
   */
  private async establishConnection(): Promise<void> {
    this.setState(ConnectionState.CONNECTING);
    this.metrics.connectAttempts++;

    try {
      logger.info('Establishing MCP connection', {
        serverUrl: appConfig.MCP_SERVER_URL,
        attempt: this.metrics.connectAttempts,
      });

      // Create transport without API key - authentication handled per-request
      this.transport = new StreamableHTTPClientTransport(new URL(appConfig.MCP_SERVER_URL), {
        requestInit: {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      });

      // Create client
      this.client = new Client({
        name: 'eddo-telegram-bot',
        version: '1.0.0',
      });

      // Connect to server
      await this.client.connect(this.transport);

      // SDK handles handshake automatically, but we'll discover tools
      await this.discoverTools();

      // Update state and metrics
      this.setState(ConnectionState.CONNECTED);
      this.metrics.successfulConnections++;
      this.metrics.lastConnectionTime = new Date();
      this.metrics.currentSessionStart = new Date();
      this.reconnectAttempt = 0;
      logger.info('MCP connection established successfully', {
        toolsDiscovered: this.tools.length,
        metrics: this.getMetrics(),
      });
    } catch (error) {
      this.metrics.failedConnections++;
      this.setState(ConnectionState.FAILED);
      logger.error('Failed to establish MCP connection', {
        error: String(error),
        attempt: this.metrics.connectAttempts,
      });

      throw error;
    }
  }

  /** Discover available tools from MCP server */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const toolsResponse = await this.client.listTools();
    this.tools = toolsResponse.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || 'No description available',
      inputSchema: tool.inputSchema,
    }));
    logger.info('MCP tools discovered', {
      toolCount: this.tools.length,
      toolNames: this.tools.map((t) => t.name),
    });
  }

  /** Start health check monitoring */
  private startHealthCheck(): void {
    // Clear any existing health check
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckIntervalMs);
    logger.info('Health check monitoring started', {
      intervalMs: this.healthCheckIntervalMs,
    });
  }

  /** Stop health check monitoring */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health check monitoring stopped');
    }
  }

  /** Perform health check */
  private async performHealthCheck(): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED || !this.client) {
      return;
    }

    try {
      // Try to list tools as a health check
      // MCP SDK doesn't have a ping method, so we use a lightweight operation
      await this.client.listTools();
      logger.debug('Health check passed');
    } catch (error) {
      logger.error('Health check failed', { error: String(error) });
      await this.handleConnectionFailure();
    }
  }

  /** Handle connection failure with automatic reconnection */
  private async handleConnectionFailure(): Promise<void> {
    if (this.metrics.currentSessionStart) {
      this.metrics.totalUptime += Date.now() - this.metrics.currentSessionStart.getTime();
      this.metrics.currentSessionStart = undefined;
    }
    this.metrics.lastDisconnectionTime = new Date();
    await this.cleanup();

    if (this.reconnectAttempt < this.maxReconnectAttempts) {
      this.setState(ConnectionState.RECONNECTING);
      await this.scheduleReconnection();
    } else {
      this.setState(ConnectionState.FAILED);
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempt,
        maxAttempts: this.maxReconnectAttempts,
      });
    }
  }

  /** Schedule reconnection with exponential backoff */
  private async scheduleReconnection(): Promise<void> {
    const delay = calculateReconnectDelay(
      this.reconnectAttempt,
      this.initialReconnectDelayMs,
      this.maxReconnectDelayMs,
    );
    this.reconnectAttempt++;

    logger.info('Scheduling reconnection', { attempt: this.reconnectAttempt, delayMs: delay });

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.establishConnection();
        this.startHealthCheck();
      } catch (error) {
        logger.error('Reconnection attempt failed', {
          error: String(error),
          attempt: this.reconnectAttempt,
        });
        // Will trigger another reconnection attempt if under max
        await this.handleConnectionFailure();
      }
    }, delay);
  }

  /** Get available tools */
  getTools(): MCPTool[] {
    return [...this.tools];
  }

  /** Invokes a tool with user context */
  async invoke(
    toolName: string,
    params: Record<string, unknown>,
    userContext?: MCPUserContext,
  ): Promise<unknown> {
    this.validateInvokePrerequisites(userContext);

    logger.info('Invoking MCP tool', {
      toolName,
      params,
      username: userContext!.username,
      databaseName: userContext!.databaseName,
    });

    try {
      return await this.executeToolInvocation(toolName, params, userContext!);
    } catch (error) {
      await this.handleInvocationError(toolName, params, error);
      throw error;
    }
  }

  private validateInvokePrerequisites(userContext?: MCPUserContext): void {
    if (this.state !== ConnectionState.CONNECTED || !this.client) {
      throw new Error(`Cannot invoke tool: connection state is ${this.state}`);
    }
    if (!userContext) {
      throw new Error('User context is required for MCP tool invocation');
    }
  }

  private async executeToolInvocation(
    toolName: string,
    params: Record<string, unknown>,
    userContext: MCPUserContext,
  ): Promise<unknown> {
    const userClient = await createUserClient(userContext);
    try {
      return await invokeToolOnClient(userClient, toolName, params);
    } finally {
      await userClient.close();
    }
  }

  private async handleInvocationError(
    toolName: string,
    params: Record<string, unknown>,
    error: unknown,
  ): Promise<void> {
    logger.error('MCP tool invocation failed', { toolName, params, error: String(error) });
    if (checkIsConnectionError(error)) {
      await this.handleConnectionFailure();
    }
  }

  /**
   */
  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      logger.info('Connection state changed', {
        from: oldState,
        to: newState,
      });
    }
  }

  /** Clean up resources */
  private async cleanup(): Promise<void> {
    this.stopHealthCheck();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        logger.error('Error closing client', { error: String(error) });
      }
      this.client = null;
    }

    this.transport = null;
    this.tools = [];
  }

  /** Close connection and clean up */
  async close(): Promise<void> {
    logger.info('Closing MCP connection manager');

    // Update final metrics
    if (this.metrics.currentSessionStart) {
      const sessionUptime = Date.now() - this.metrics.currentSessionStart.getTime();
      this.metrics.totalUptime += sessionUptime;
      this.metrics.currentSessionStart = undefined;
    }

    await this.cleanup();
    this.setState(ConnectionState.DISCONNECTED);

    logger.info('MCP connection manager closed', {
      finalMetrics: this.getMetrics(),
    });
  }
}
