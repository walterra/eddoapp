/**
 * Collapsible sidebar for displaying audit log entries.
 * Shows recent todo operations with real-time updates via SSE.
 */
import { type FC, useState } from 'react';

import type { AuditAction, AuditLogAlpha1 } from '@eddo/core-shared';

import { useAuditLog } from '../hooks/use_audit_log_data';

/** Width of the sidebar when expanded */
const SIDEBAR_WIDTH = 280;

/** Action icons and labels */
const ACTION_CONFIG: Record<AuditAction, { icon: string; label: string; color: string }> = {
  create: { icon: '+', label: 'Created', color: 'text-green-500' },
  update: { icon: '~', label: 'Updated', color: 'text-blue-500' },
  delete: { icon: '✕', label: 'Deleted', color: 'text-red-500' },
  complete: { icon: '✓', label: 'Completed', color: 'text-green-600' },
  uncomplete: { icon: '○', label: 'Reopened', color: 'text-yellow-500' },
  time_tracking_start: { icon: '▶', label: 'Started', color: 'text-purple-500' },
  time_tracking_stop: { icon: '■', label: 'Stopped', color: 'text-purple-600' },
};

/** Format relative time (e.g., "2 min ago") */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Get title from audit entry */
function getEntryTitle(entry: AuditLogAlpha1): string {
  const after = entry.after as { title?: string } | undefined;
  const before = entry.before as { title?: string } | undefined;
  return after?.title || before?.title || entry.entityId.slice(0, 16) + '...';
}

interface AuditEntryItemProps {
  entry: AuditLogAlpha1;
}

const AuditEntryItem: FC<AuditEntryItemProps> = ({ entry }) => {
  const config = ACTION_CONFIG[entry.action];
  const title = getEntryTitle(entry);

  return (
    <div className="border-b border-neutral-200 px-3 py-2 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
      <div className="flex items-start gap-2">
        <span className={`font-mono text-lg ${config.color}`}>{config.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {title}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {config.label} · {formatRelativeTime(entry.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};

interface SidebarHeaderProps {
  isConnected: boolean;
  onCollapse: () => void;
}

const SidebarHeader: FC<SidebarHeaderProps> = ({ isConnected, onCollapse }) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Activity</h2>
      <span
        className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-400'}`}
        title={isConnected ? 'Connected' : 'Disconnected'}
      />
    </div>
    <button
      className="p-1 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      onClick={onCollapse}
      title="Collapse sidebar"
    >
      ✕
    </button>
  </div>
);

interface CollapsedToggleProps {
  onClick: () => void;
}

const CollapsedToggle: FC<CollapsedToggleProps> = ({ onClick }) => (
  <button
    className="fixed top-1/2 right-0 z-10 -translate-y-1/2 rounded-l-md border border-r-0 border-neutral-200 bg-white px-1 py-3 text-neutral-600 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
    onClick={onClick}
    title="Show activity log"
  >
    📋
  </button>
);

export interface AuditSidebarProps {
  /** Whether sidebar is visible */
  isOpen?: boolean;
  /** Callback when sidebar is toggled */
  onToggle?: (isOpen: boolean) => void;
}

export const AuditSidebar: FC<AuditSidebarProps> = ({ isOpen = true, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(isOpen);
  const { entries, isLoading, isConnected } = useAuditLog({ enabled: isExpanded });

  const handleToggle = (expanded: boolean) => {
    setIsExpanded(expanded);
    onToggle?.(expanded);
  };

  if (!isExpanded) {
    return <CollapsedToggle onClick={() => handleToggle(true)} />;
  }

  return (
    <aside
      className="flex h-full flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <SidebarHeader isConnected={isConnected} onCollapse={() => handleToggle(false)} />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-3 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No activity yet
          </div>
        ) : (
          entries.map((entry) => <AuditEntryItem entry={entry} key={entry._id} />)
        )}
      </div>
    </aside>
  );
};
