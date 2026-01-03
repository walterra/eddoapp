/**
 * Health check and reconnection management for MCP connections.
 *
 * Handles:
 * - Periodic health checks via listTools()
 * - Automatic reconnection with exponential backoff
 * - Connection failure detection and recovery
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { logger } from '../utils/logger.js';

import { calculateReconnectDelay } from './connection-manager-helpers.js';

/** Configuration for health check and reconnection behavior */
export interface HealthManagerConfig {
  /** Interval between health checks in milliseconds */
  healthCheckIntervalMs: number;
  /** Maximum number of reconnection attempts before giving up */
  maxReconnectAttempts: number;
  /** Initial delay before first reconnection attempt in milliseconds */
  initialReconnectDelayMs: number;
  /** Maximum delay between reconnection attempts in milliseconds */
  maxReconnectDelayMs: number;
}

/** Default configuration values */
export const DEFAULT_HEALTH_CONFIG: HealthManagerConfig = {
  healthCheckIntervalMs: 30000,
  maxReconnectAttempts: 5,
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 60000,
};

/** Callback functions for connection lifecycle events */
export interface HealthManagerCallbacks {
  /** Called to perform reconnection */
  onReconnect: () => Promise<void>;
  /** Called when connection failure is detected */
  onConnectionFailure: () => Promise<void>;
  /** Called when max reconnection attempts are exhausted */
  onMaxReconnectAttemptsReached: () => void;
}

/**
 * Manages health checks and reconnection for MCP connections.
 */
export class ConnectionHealthManager {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private readonly config: HealthManagerConfig;
  private readonly callbacks: HealthManagerCallbacks;

  constructor(callbacks: HealthManagerCallbacks, config: Partial<HealthManagerConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  /** Start periodic health check monitoring */
  startHealthCheck(client: Client): void {
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck(client);
    }, this.config.healthCheckIntervalMs);

    logger.info('Health check monitoring started', {
      intervalMs: this.config.healthCheckIntervalMs,
    });
  }

  /** Stop health check monitoring */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health check monitoring stopped');
    }
  }

  /** Perform a single health check */
  private async performHealthCheck(client: Client): Promise<void> {
    try {
      await client.listTools();
      logger.debug('Health check passed');
    } catch (error) {
      logger.error('Health check failed', { error: String(error) });
      await this.callbacks.onConnectionFailure();
    }
  }

  /** Reset reconnection attempt counter (call after successful connection) */
  resetReconnectAttempts(): void {
    this.reconnectAttempt = 0;
  }

  /** Check if more reconnection attempts are available */
  canReconnect(): boolean {
    return this.reconnectAttempt < this.config.maxReconnectAttempts;
  }

  /** Get current reconnection attempt count */
  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  /** Schedule a reconnection attempt with exponential backoff */
  scheduleReconnection(): void {
    const delay = calculateReconnectDelay(
      this.reconnectAttempt,
      this.config.initialReconnectDelayMs,
      this.config.maxReconnectDelayMs,
    );
    this.reconnectAttempt++;

    logger.info('Scheduling reconnection', { attempt: this.reconnectAttempt, delayMs: delay });

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.callbacks.onReconnect();
      } catch (error) {
        logger.error('Reconnection attempt failed', {
          error: String(error),
          attempt: this.reconnectAttempt,
        });
        await this.handleReconnectionFailure();
      }
    }, delay);
  }

  /** Handle failed reconnection attempt */
  private async handleReconnectionFailure(): Promise<void> {
    if (this.canReconnect()) {
      this.scheduleReconnection();
    } else {
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempt,
        maxAttempts: this.config.maxReconnectAttempts,
      });
      this.callbacks.onMaxReconnectAttemptsReached();
    }
  }

  /** Clean up all timers and resources */
  cleanup(): void {
    this.stopHealthCheck();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
