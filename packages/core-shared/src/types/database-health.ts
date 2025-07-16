/**
 * Database health monitoring types and interfaces
 */

export interface DatabaseHealthMetrics {
  /** Database connection status */
  isConnected: boolean;
  /** Last successful operation timestamp */
  lastSuccessfulOperation: Date | null;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Response time for last operation in milliseconds */
  lastResponseTime: number | null;
  /** Current sync status */
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  /** Available storage quota information */
  storageQuota: {
    used: number;
    available: number;
    percentage: number;
  } | null;
}

export interface DatabaseHealthCheck {
  /** Timestamp of the health check */
  timestamp: Date;
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Detailed metrics */
  metrics: DatabaseHealthMetrics;
  /** Any issues detected */
  issues: DatabaseHealthIssue[];
}

export interface DatabaseHealthIssue {
  /** Type of issue detected */
  type: 'connectivity' | 'performance' | 'storage' | 'sync';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description */
  message: string;
  /** Suggested resolution */
  resolution?: string;
  /** Whether the issue can be auto-resolved */
  autoResolvable: boolean;
}

export interface DatabaseHealthConfig {
  /** How often to run health checks (ms) */
  checkInterval: number;
  /** Connection timeout for health checks (ms) */
  connectionTimeout: number;
  /** Performance threshold for response time (ms) */
  performanceThreshold: number;
  /** Storage warning threshold (percentage) */
  storageWarningThreshold: number;
  /** Storage critical threshold (percentage) */
  storageCriticalThreshold: number;
  /** Maximum consecutive failures before marking unhealthy */
  maxConsecutiveFailures: number;
}

export const DEFAULT_HEALTH_CONFIG: DatabaseHealthConfig = {
  checkInterval: 30000, // 30 seconds
  connectionTimeout: 5000, // 5 seconds
  performanceThreshold: 2000, // 2 seconds
  storageWarningThreshold: 80, // 80%
  storageCriticalThreshold: 95, // 95%
  maxConsecutiveFailures: 3,
};
