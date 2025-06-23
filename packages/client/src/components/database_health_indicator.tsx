/**
 * Database health indicator component
 */
import { DatabaseHealthCheck } from '@eddo/shared';
import React from 'react';

interface DatabaseHealthIndicatorProps {
  /** Current health check data */
  healthCheck: DatabaseHealthCheck | null;
  /** Whether to show detailed metrics */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const DatabaseHealthIndicator: React.FC<
  DatabaseHealthIndicatorProps
> = ({ healthCheck, showDetails = false, className = '' }) => {
  if (!healthCheck) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
        <span className="text-sm text-gray-500">Unknown</span>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'degraded':
        return 'Degraded';
      case 'unhealthy':
        return 'Unhealthy';
      default:
        return 'Unknown';
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const criticalIssues = healthCheck.issues.filter(
    (issue) => issue.severity === 'critical',
  );
  const highIssues = healthCheck.issues.filter(
    (issue) => issue.severity === 'high',
  );

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${getStatusColor(healthCheck.status)}`}
        ></div>
        <span className="text-sm font-medium">
          {getStatusText(healthCheck.status)}
        </span>
        {healthCheck.metrics.lastResponseTime && (
          <span className="text-xs text-gray-500">
            ({healthCheck.metrics.lastResponseTime}ms)
          </span>
        )}
      </div>

      {showDetails && (
        <div className="mt-2 space-y-2">
          <div className="text-xs text-gray-600">
            Last check: {formatTimestamp(healthCheck.timestamp)}
          </div>

          {healthCheck.metrics.storageQuota && (
            <div className="text-xs">
              <span className="text-gray-600">Storage: </span>
              <span
                className={
                  healthCheck.metrics.storageQuota.percentage > 80
                    ? 'text-orange-600'
                    : 'text-gray-800'
                }
              >
                {healthCheck.metrics.storageQuota.percentage.toFixed(1)}% used
              </span>
            </div>
          )}

          <div className="text-xs">
            <span className="text-gray-600">Sync: </span>
            <span
              className={`capitalize ${
                healthCheck.metrics.syncStatus === 'connected'
                  ? 'text-green-600'
                  : healthCheck.metrics.syncStatus === 'error'
                    ? 'text-red-600'
                    : 'text-yellow-600'
              }`}
            >
              {healthCheck.metrics.syncStatus}
            </span>
          </div>

          {healthCheck.metrics.consecutiveFailures > 0 && (
            <div className="text-xs text-red-600">
              Consecutive failures: {healthCheck.metrics.consecutiveFailures}
            </div>
          )}

          {(criticalIssues.length > 0 || highIssues.length > 0) && (
            <div className="mt-2">
              {criticalIssues.map((issue, index) => (
                <div className="mb-1 text-xs text-red-600" key={index}>
                  <strong>Critical:</strong> {issue.message}
                </div>
              ))}
              {highIssues.map((issue, index) => (
                <div className="mb-1 text-xs text-orange-600" key={index}>
                  <strong>Warning:</strong> {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
