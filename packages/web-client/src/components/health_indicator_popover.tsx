/**
 * HealthIndicatorPopover - Compact health status icon with popover details
 */
import { type DatabaseHealthCheck } from '@eddo/core-client';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFloatingPosition } from '../hooks/use_floating_position';
import { TRANSITION_FAST } from '../styles/interactive';

interface HealthIndicatorPopoverProps {
  healthCheck: DatabaseHealthCheck | null;
  databaseName?: string;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy':
      return 'bg-success-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'unhealthy':
      return 'bg-error-500';
    default:
      return 'bg-neutral-400';
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
  if (syncStatus === 'connected') return 'text-success-600';
  if (syncStatus === 'error') return 'text-error-600';
  return 'text-yellow-600';
};

const POPOVER_STYLES =
  'z-50 min-w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

/** Hook for popover dismiss behavior (click outside, escape key) */
const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

const MetricRow: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between py-1">
    <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
    <span className="font-medium text-neutral-800 dark:text-neutral-200">{children}</span>
  </div>
);

const IssuesList: FC<{ issues: DatabaseHealthCheck['issues'] }> = ({ issues }) => {
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical');
  const highIssues = issues.filter((issue) => issue.severity === 'high');

  if (criticalIssues.length === 0 && highIssues.length === 0) return null;

  return (
    <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-600">
      {criticalIssues.map((issue, index) => (
        <div className="text-error-600 text-xs" key={`critical-${index}`}>
          <strong>Critical:</strong> {issue.message}
        </div>
      ))}
      {highIssues.map((issue, index) => (
        <div className="text-xs text-orange-600" key={`high-${index}`}>
          <strong>Warning:</strong> {issue.message}
        </div>
      ))}
    </div>
  );
};

interface PopoverHeaderProps {
  healthCheck: DatabaseHealthCheck;
}

const PopoverHeader: FC<PopoverHeaderProps> = ({ healthCheck }) => (
  <div className="mb-2 flex items-center gap-2">
    <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(healthCheck.status)}`} />
    <span className="font-medium">{getStatusText(healthCheck.status)}</span>
    {healthCheck.metrics.lastResponseTime && (
      <span className="text-xs text-neutral-500">({healthCheck.metrics.lastResponseTime}ms)</span>
    )}
  </div>
);

interface MetricsListProps {
  healthCheck: DatabaseHealthCheck;
  databaseName?: string;
}

const MetricsList: FC<MetricsListProps> = ({ healthCheck, databaseName }) => (
  <div className="text-xs">
    {databaseName && <MetricRow label="Database">{databaseName}</MetricRow>}
    <MetricRow label="Last Check">{formatTimestamp(healthCheck.timestamp)}</MetricRow>
    <MetricRow label="Sync Status">
      <span className={`capitalize ${getSyncStatusClassName(healthCheck.metrics.syncStatus)}`}>
        {healthCheck.metrics.syncStatus}
      </span>
    </MetricRow>
    {healthCheck.metrics.storageQuota && (
      <MetricRow label="Storage">
        <span
          className={
            healthCheck.metrics.storageQuota.percentage > 80 ? 'text-orange-600' : undefined
          }
        >
          {healthCheck.metrics.storageQuota.percentage.toFixed(1)}%
        </span>
      </MetricRow>
    )}
    {healthCheck.metrics.consecutiveFailures > 0 && (
      <MetricRow label="Failures">
        <span className="text-error-600">{healthCheck.metrics.consecutiveFailures}</span>
      </MetricRow>
    )}
  </div>
);

interface PopoverContentProps {
  healthCheck: DatabaseHealthCheck;
  databaseName?: string;
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  onClose: () => void;
}

const PopoverContent: FC<PopoverContentProps> = ({
  healthCheck,
  databaseName,
  floatingStyles,
  setFloatingRef,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, onClose);

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <PopoverHeader healthCheck={healthCheck} />
      <MetricsList databaseName={databaseName} healthCheck={healthCheck} />
      <IssuesList issues={healthCheck.issues} />
    </div>,
    document.body,
  );
};

interface HealthTriggerProps {
  status: string;
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

const HealthTrigger: FC<HealthTriggerProps> = ({ status, onClick, setReferenceRef }) => (
  <button
    aria-label="Database health status"
    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
    onClick={onClick}
    ref={setReferenceRef}
    title={`Database: ${getStatusText(status)}`}
    type="button"
  >
    <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(status)}`} />
  </button>
);

const UnknownTrigger: FC = () => (
  <div className="flex h-8 w-8 items-center justify-center" title="Database status unknown">
    <div className="h-2.5 w-2.5 rounded-full bg-neutral-400" />
  </div>
);

export const HealthIndicatorPopover: FC<HealthIndicatorPopoverProps> = ({
  healthCheck,
  databaseName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-end',
    open: isOpen,
  });

  if (!healthCheck) {
    return <UnknownTrigger />;
  }

  return (
    <>
      <HealthTrigger
        onClick={() => setIsOpen(true)}
        setReferenceRef={refs.setReference}
        status={healthCheck.status}
      />
      {isOpen && (
        <PopoverContent
          databaseName={databaseName}
          floatingStyles={floatingStyles}
          healthCheck={healthCheck}
          onClose={() => setIsOpen(false)}
          setFloatingRef={refs.setFloating}
        />
      )}
    </>
  );
};
