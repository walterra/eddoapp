/**
 * Database health monitoring system
 */
import { DatabaseError, DatabaseErrorType } from '../types/database-errors';
import {
  DEFAULT_HEALTH_CONFIG,
  DatabaseHealthCheck,
  DatabaseHealthConfig,
  DatabaseHealthIssue,
  DatabaseHealthMetrics,
} from '../types/database-health';

export class DatabaseHealthMonitor {
  private config: DatabaseHealthConfig;
  private db: PouchDB.Database;
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: ((healthCheck: DatabaseHealthCheck) => void)[] = [];
  private currentMetrics: DatabaseHealthMetrics;

  constructor(db: PouchDB.Database, config: Partial<DatabaseHealthConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
    this.currentMetrics = this.initializeMetrics();
  }

  private initializeMetrics(): DatabaseHealthMetrics {
    return {
      isConnected: false,
      lastSuccessfulOperation: null,
      consecutiveFailures: 0,
      lastResponseTime: null,
      syncStatus: 'disconnected',
      storageQuota: null,
    };
  }

  /**
   * Start monitoring database health
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    // Run initial check
    this.performHealthCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring database health
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add a listener for health check updates
   */
  addListener(listener: (healthCheck: DatabaseHealthCheck) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a health check listener
   */
  removeListener(listener: (healthCheck: DatabaseHealthCheck) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get current health metrics
   */
  getCurrentMetrics(): DatabaseHealthMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Perform a manual health check
   */
  async performHealthCheck(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now();
    const issues: DatabaseHealthIssue[] = [];

    try {
      // Test database connectivity with a simple operation
      await this.db.info();

      const responseTime = Date.now() - startTime;

      // Update metrics on success
      this.currentMetrics.isConnected = true;
      this.currentMetrics.lastSuccessfulOperation = new Date();
      this.currentMetrics.consecutiveFailures = 0;
      this.currentMetrics.lastResponseTime = responseTime;

      // Check performance
      if (responseTime > this.config.performanceThreshold) {
        issues.push({
          type: 'performance',
          severity: responseTime > this.config.performanceThreshold * 2 ? 'high' : 'medium',
          message: `Database response time is ${responseTime}ms, exceeding threshold of ${this.config.performanceThreshold}ms`,
          resolution: 'Consider optimizing database queries or checking network conditions',
          autoResolvable: false,
        });
      }

      // Check storage quota if available
      try {
        const storageQuota = await this.checkStorageQuota();
        this.currentMetrics.storageQuota = storageQuota;

        if (storageQuota && storageQuota.percentage >= this.config.storageCriticalThreshold) {
          issues.push({
            type: 'storage',
            severity: 'critical',
            message: `Storage is ${storageQuota.percentage.toFixed(1)}% full`,
            resolution: 'Delete unnecessary data or increase storage quota',
            autoResolvable: false,
          });
        } else if (storageQuota && storageQuota.percentage >= this.config.storageWarningThreshold) {
          issues.push({
            type: 'storage',
            severity: 'medium',
            message: `Storage is ${storageQuota.percentage.toFixed(1)}% full`,
            resolution: 'Consider cleaning up old data',
            autoResolvable: false,
          });
        }
      } catch (error) {
        // Storage quota check failed, but this is non-critical
        console.warn('Failed to check storage quota:', error);
      }
    } catch (error) {
      // Update metrics on failure
      this.currentMetrics.isConnected = false;
      this.currentMetrics.consecutiveFailures++;
      this.currentMetrics.lastResponseTime = Date.now() - startTime;

      // Classify the error
      const dbError = this.classifyError(error);

      issues.push({
        type: 'connectivity',
        severity:
          this.currentMetrics.consecutiveFailures >= this.config.maxConsecutiveFailures
            ? 'critical'
            : 'high',
        message: `Database connection failed: ${dbError.message}`,
        resolution: this.getResolutionForError(dbError),
        autoResolvable: dbError.retryable,
      });
    }

    // Determine overall health status
    const status = this.determineHealthStatus(issues);

    const healthCheck: DatabaseHealthCheck = {
      timestamp: new Date(),
      status,
      metrics: { ...this.currentMetrics },
      issues,
    };

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(healthCheck);
      } catch (error) {
        console.error('Error in health check listener:', error);
      }
    });

    return healthCheck;
  }

  private async checkStorageQuota(): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage !== undefined) {
          const used = estimate.usage;
          const available = estimate.quota;
          const percentage = (used / available) * 100;
          return { used, available, percentage };
        }
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }
    return null;
  }

  private classifyError(error: unknown): DatabaseError {
    const errorObj = error as Record<string, unknown>;

    // Reuse existing error classification logic
    if (errorObj.name === 'QuotaExceededError' || errorObj.code === 22) {
      return {
        name: 'DatabaseOperationError',
        message: 'Storage quota exceeded',
        type: DatabaseErrorType.QUOTA_EXCEEDED,
        originalError: error as Error,
        operation: 'health_check',
        retryable: false,
      };
    }

    if (errorObj.name === 'NetworkError' || errorObj.code === 'NETWORK_ERR') {
      return {
        name: 'DatabaseOperationError',
        message: 'Network connectivity issue',
        type: DatabaseErrorType.NETWORK_ERROR,
        originalError: error as Error,
        operation: 'health_check',
        retryable: true,
      };
    }

    return {
      name: 'DatabaseOperationError',
      message: (errorObj.message as string) || 'Unknown database error',
      type: DatabaseErrorType.OPERATION_FAILED,
      originalError: error as Error,
      operation: 'health_check',
      retryable: false,
    };
  }

  private getResolutionForError(error: DatabaseError): string {
    switch (error.type) {
      case DatabaseErrorType.QUOTA_EXCEEDED:
        return 'Free up storage space or increase quota';
      case DatabaseErrorType.NETWORK_ERROR:
        return 'Check network connection and try again';
      case DatabaseErrorType.PERMISSION_DENIED:
        return 'Check database permissions';
      default:
        return 'Check database configuration and connectivity';
    }
  }

  private determineHealthStatus(
    issues: DatabaseHealthIssue[],
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (issues.length === 0) {
      return 'healthy';
    }

    const hasCritical = issues.some((issue) => issue.severity === 'critical');
    const hasHigh = issues.some((issue) => issue.severity === 'high');

    if (hasCritical || !this.currentMetrics.isConnected) {
      return 'unhealthy';
    }

    if (hasHigh || issues.length > 2) {
      return 'degraded';
    }

    return 'degraded';
  }

  /**
   * Update sync status from external sync handler
   */
  updateSyncStatus(status: 'connected' | 'disconnected' | 'syncing' | 'error'): void {
    this.currentMetrics.syncStatus = status;
  }

  /**
   * Record a successful database operation
   */
  recordSuccessfulOperation(responseTime?: number): void {
    this.currentMetrics.lastSuccessfulOperation = new Date();
    this.currentMetrics.consecutiveFailures = 0;
    if (responseTime !== undefined) {
      this.currentMetrics.lastResponseTime = responseTime;
    }
  }

  /**
   * Record a failed database operation
   */
  recordFailedOperation(): void {
    this.currentMetrics.consecutiveFailures++;
  }
}
