/**
 * Database health indicator component
 */
import { DatabaseHealthCheck } from '@eddo/core-client';

interface DatabaseHealthIndicatorProps {
  /** Current health check data */
  healthCheck: DatabaseHealthCheck | null;
  /** Whether to show detailed metrics */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Database name to display */
  databaseName?: string;
}

export const DatabaseHealthIndicator: React.FC<DatabaseHealthIndicatorProps> = ({
  healthCheck,
  showDetails = false,
  className = '',
  databaseName,
}) => {
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

  const criticalIssues = healthCheck.issues.filter((issue) => issue.severity === 'critical');
  const highIssues = healthCheck.issues.filter((issue) => issue.severity === 'high');

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${getStatusColor(healthCheck.status)}`}></div>
        <span className="text-sm font-medium">{getStatusText(healthCheck.status)}</span>
        {healthCheck.metrics.lastResponseTime && (
          <span className="text-xs text-gray-500">({healthCheck.metrics.lastResponseTime}ms)</span>
        )}
      </div>

      {showDetails && (
        <div className="mt-1 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {databaseName && (
              <div>
                <span className="text-gray-600">DB: </span>
                <span className="font-mono text-gray-800">{databaseName}</span>
              </div>
            )}
            <div>Last: {formatTimestamp(healthCheck.timestamp)}</div>
            {healthCheck.metrics.storageQuota && (
              <div>
                <span className="text-gray-600">Storage: </span>
                <span
                  className={
                    healthCheck.metrics.storageQuota.percentage > 80
                      ? 'text-orange-600'
                      : 'text-gray-800'
                  }
                >
                  {healthCheck.metrics.storageQuota.percentage.toFixed(1)}%
                </span>
              </div>
            )}
            <div>
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
              <div className="text-red-600">
                Failures: {healthCheck.metrics.consecutiveFailures}
              </div>
            )}
          </div>
          {(criticalIssues.length > 0 || highIssues.length > 0) && (
            <div className="mt-1 flex flex-wrap gap-x-4">
              {criticalIssues.map((issue, index) => (
                <div className="text-red-600" key={index}>
                  <strong>Critical:</strong> {issue.message}
                </div>
              ))}
              {highIssues.map((issue, index) => (
                <div className="text-orange-600" key={index}>
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
