/**
 * Database health indicator component
 */
import { type FC } from 'react';

import { type DatabaseHealthCheck } from '@eddo/core-client';

interface DatabaseHealthIndicatorProps {
  healthCheck: DatabaseHealthCheck | null;
  showDetails?: boolean;
  className?: string;
  databaseName?: string;
}

const getStatusColor = (status: string): string => {
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

const getStatusText = (status: string): string => {
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

const formatTimestamp = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);

const getSyncStatusClassName = (syncStatus: string): string => {
  if (syncStatus === 'connected') return 'text-green-600';
  if (syncStatus === 'error') return 'text-red-600';
  return 'text-yellow-600';
};

const UnknownStatus: FC<{ className: string }> = ({ className }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="h-2 w-2 rounded-full bg-gray-400"></div>
    <span className="text-sm text-gray-500">Unknown</span>
  </div>
);

interface StatusBadgeProps {
  status: string;
  responseTime?: number;
}

const StatusBadge: FC<StatusBadgeProps> = ({ status, responseTime }) => (
  <div className="flex items-center gap-2">
    <div className={`h-2 w-2 rounded-full ${getStatusColor(status)}`}></div>
    <span className="text-sm font-medium">{getStatusText(status)}</span>
    {responseTime && <span className="text-xs text-gray-500">({responseTime}ms)</span>}
  </div>
);

interface MetricsRowProps {
  healthCheck: DatabaseHealthCheck;
  databaseName?: string;
}

const MetricsRow: FC<MetricsRowProps> = ({ healthCheck, databaseName }) => (
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
            healthCheck.metrics.storageQuota.percentage > 80 ? 'text-orange-600' : 'text-gray-800'
          }
        >
          {healthCheck.metrics.storageQuota.percentage.toFixed(1)}%
        </span>
      </div>
    )}
    <div>
      <span className="text-gray-600">Sync: </span>
      <span className={`capitalize ${getSyncStatusClassName(healthCheck.metrics.syncStatus)}`}>
        {healthCheck.metrics.syncStatus}
      </span>
    </div>
    {healthCheck.metrics.consecutiveFailures > 0 && (
      <div className="text-red-600">Failures: {healthCheck.metrics.consecutiveFailures}</div>
    )}
  </div>
);

interface IssuesDisplayProps {
  issues: DatabaseHealthCheck['issues'];
}

const IssuesDisplay: FC<IssuesDisplayProps> = ({ issues }) => {
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical');
  const highIssues = issues.filter((issue) => issue.severity === 'high');
  if (criticalIssues.length === 0 && highIssues.length === 0) return null;

  return (
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
  );
};

interface DetailsDisplayProps {
  healthCheck: DatabaseHealthCheck;
  databaseName?: string;
}

const DetailsDisplay: FC<DetailsDisplayProps> = ({ healthCheck, databaseName }) => (
  <div className="mt-1 text-xs text-gray-600">
    <MetricsRow databaseName={databaseName} healthCheck={healthCheck} />
    <IssuesDisplay issues={healthCheck.issues} />
  </div>
);

export const DatabaseHealthIndicator: FC<DatabaseHealthIndicatorProps> = ({
  healthCheck,
  showDetails = false,
  className = '',
  databaseName,
}) => {
  if (!healthCheck) return <UnknownStatus className={className} />;

  return (
    <div className={className}>
      <StatusBadge
        responseTime={healthCheck.metrics.lastResponseTime ?? undefined}
        status={healthCheck.status}
      />
      {showDetails && <DetailsDisplay databaseName={databaseName} healthCheck={healthCheck} />}
    </div>
  );
};
