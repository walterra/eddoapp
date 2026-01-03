import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

import type { MCPTool } from './client.js';
import { ConnectionHealthManager, type HealthManagerConfig } from './connection-health.js';
import {
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
  totalUptime: number;
  currentSessionStart?: Date;
}

export class MCPConnectionManager {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private tools: MCPTool[] = [];
  private metrics: ConnectionMetrics = {
    connectAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalUptime: 0,
  };
  private readonly healthManager: ConnectionHealthManager;

  constructor(healthConfig: Partial<HealthManagerConfig> = {}) {
    this.healthManager = new ConnectionHealthManager(
      {
        onReconnect: () => this.performReconnection(),
        onConnectionFailure: () => this.handleConnectionFailure(),
        onMaxReconnectAttemptsReached: () => this.setState(ConnectionState.FAILED),
      },
      healthConfig,
    );
    logger.info('MCPConnectionManager initialized');
  }

  /** Get current connection state */
  getState(): ConnectionState {
    return this.state;
  }

  /** Get connection metrics */
  getMetrics(): ConnectionMetrics {
    if (this.state === ConnectionState.CONNECTED && this.metrics.currentSessionStart) {
      const sessionUptime = Date.now() - this.metrics.currentSessionStart.getTime();
      return {
        ...this.metrics,
        totalUptime: this.metrics.totalUptime + sessionUptime,
      };
    }
    return { ...this.metrics };
  }

  /** Get available tools */
  getTools(): MCPTool[] {
    return [...this.tools];
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
      if (this.client) {
        this.healthManager.startHealthCheck(this.client);
      }
    } catch (error) {
      logger.error('Failed to initialize MCP connection', { error: String(error) });
      throw error;
    }
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

  /** Close connection and clean up */
  async close(): Promise<void> {
    logger.info('Closing MCP connection manager');

    if (this.metrics.currentSessionStart) {
      const sessionUptime = Date.now() - this.metrics.currentSessionStart.getTime();
      this.metrics.totalUptime += sessionUptime;
      this.metrics.currentSessionStart = undefined;
    }

    await this.cleanup();
    this.setState(ConnectionState.DISCONNECTED);

    logger.info('MCP connection manager closed', { finalMetrics: this.getMetrics() });
  }

  /**
   * Establish connection to MCP server.
   * Creates a base connection without user-specific authentication.
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

      this.transport = new StreamableHTTPClientTransport(new URL(appConfig.MCP_SERVER_URL), {
        requestInit: {
          headers: { 'Content-Type': 'application/json' },
        },
      });

      this.client = new Client({ name: 'eddo-telegram-bot', version: '1.0.0' });
      await this.client.connect(this.transport);
      await this.discoverTools();

      this.setState(ConnectionState.CONNECTED);
      this.metrics.successfulConnections++;
      this.metrics.lastConnectionTime = new Date();
      this.metrics.currentSessionStart = new Date();
      this.healthManager.resetReconnectAttempts();

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

  /** Handle connection failure with automatic reconnection */
  private async handleConnectionFailure(): Promise<void> {
    if (this.metrics.currentSessionStart) {
      this.metrics.totalUptime += Date.now() - this.metrics.currentSessionStart.getTime();
      this.metrics.currentSessionStart = undefined;
    }
    this.metrics.lastDisconnectionTime = new Date();

    await this.cleanup();

    if (this.healthManager.canReconnect()) {
      this.setState(ConnectionState.RECONNECTING);
      this.healthManager.scheduleReconnection();
    } else {
      this.setState(ConnectionState.FAILED);
    }
  }

  /** Perform reconnection attempt */
  private async performReconnection(): Promise<void> {
    await this.establishConnection();
    if (this.client) {
      this.healthManager.startHealthCheck(this.client);
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

  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      logger.info('Connection state changed', { from: oldState, to: newState });
    }
  }

  /** Clean up resources */
  private async cleanup(): Promise<void> {
    this.healthManager.cleanup();

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
}
