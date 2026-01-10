/**
 * Collapsible sidebar for displaying audit log entries.
 * Shows recent todo operations with real-time updates via SSE.
 */
import { type Todo } from '@eddo/core-client';
import { type FC, useCallback, useState } from 'react';
import { BiCloud, BiEnvelope, BiGitBranch, BiGlobe, BiRss, BiTerminal } from 'react-icons/bi';

import type { AuditAction, AuditLogAlpha1, AuditSource } from '@eddo/core-shared';

import { useAuditLog } from '../hooks/use_audit_log_data';
import { useHighlightContext } from '../hooks/use_highlight_context';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { usePouchDb } from '../pouch_db';

/** Width of the sidebar when expanded */
const SIDEBAR_WIDTH = 320;

/** Maximum entries displayed in the sidebar */
const MAX_DISPLAY_ENTRIES = 20;

/** Action icons and labels */
const ACTION_CONFIG: Record<AuditAction, { icon: string; label: string; color: string }> = {
  create: { icon: '+', label: 'Created', color: 'text-neutral-500 dark:text-neutral-400' },
  update: { icon: '~', label: 'Updated', color: 'text-neutral-500 dark:text-neutral-400' },
  delete: { icon: '✕', label: 'Deleted', color: 'text-neutral-500 dark:text-neutral-400' },
  complete: { icon: '✓', label: 'Completed', color: 'text-neutral-500 dark:text-neutral-400' },
  uncomplete: { icon: '○', label: 'Reopened', color: 'text-neutral-500 dark:text-neutral-400' },
  time_tracking_start: {
    icon: '▶',
    label: 'Started',
    color: 'text-neutral-500 dark:text-neutral-400',
  },
  time_tracking_stop: {
    icon: '■',
    label: 'Stopped',
    color: 'text-neutral-500 dark:text-neutral-400',
  },
};

/** Source icons and labels */
const SOURCE_CONFIG: Record<AuditSource, { icon: FC<{ size: string }>; label: string }> = {
  web: { icon: BiGlobe, label: 'Web' },
  mcp: { icon: BiTerminal, label: 'MCP' },
  telegram: { icon: BiCloud, label: 'Telegram' },
  'github-sync': { icon: BiGitBranch, label: 'GitHub' },
  'rss-sync': { icon: BiRss, label: 'RSS' },
  'email-sync': { icon: BiEnvelope, label: 'Email' },
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

/** Skeleton loader for audit entries */
const AuditEntrySkeleton: FC = () => (
  <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
    <div className="flex items-start gap-2">
      <div className="h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </div>
  </div>
);

/** Loading skeleton for initial load */
const LoadingSkeleton: FC = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <AuditEntrySkeleton key={i} />
    ))}
  </>
);

interface AuditEntryContentProps {
  entry: AuditLogAlpha1;
}

/** Content within an audit entry button */
const AuditEntryContent: FC<AuditEntryContentProps> = ({ entry }) => {
  const actionConfig = ACTION_CONFIG[entry.action];
  const sourceConfig = SOURCE_CONFIG[entry.source];
  const SourceIcon = sourceConfig.icon;
  const title = getEntryTitle(entry);

  return (
    <>
      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
      {entry.message && (
        <p className="truncate text-xs text-neutral-600 italic dark:text-neutral-300">
          {entry.message}
        </p>
      )}
      <p className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`font-mono text-xs ${actionConfig.color}`}>{actionConfig.icon}</span>
        {actionConfig.label}
        <span className="mx-0.5">·</span>
        <SourceIcon size="0.9em" />
        <span className="mx-0.5">·</span>
        {formatRelativeTime(entry.timestamp)}
      </p>
    </>
  );
};

interface AuditEntryItemProps {
  entry: AuditLogAlpha1;
  onEntryClick: (entityId: string) => void;
  onEntryHover: (entityId: string | null) => void;
  isDeleted: boolean;
}

const AuditEntryItem: FC<AuditEntryItemProps> = ({
  entry,
  onEntryClick,
  onEntryHover,
  isDeleted,
}) => {
  const isClickable = !isDeleted;

  const handleClick = () => isClickable && onEntryClick(entry.entityId);
  const handleMouseEnter = () => !isDeleted && onEntryHover(entry.entityId);
  const handleMouseLeave = () => onEntryHover(null);

  const className = `w-full border-b border-neutral-200 px-3 py-2 text-left dark:border-neutral-700 ${
    isClickable
      ? 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'
      : 'cursor-default opacity-60'
  }`;

  return (
    <button
      className={className}
      disabled={!isClickable}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      type="button"
    >
      <AuditEntryContent entry={entry} />
    </button>
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

/** Source filter options */
const SOURCE_FILTERS: { source: AuditSource | 'all'; label: string }[] = [
  { source: 'all', label: 'All' },
  { source: 'web', label: 'Web' },
  { source: 'mcp', label: 'MCP' },
  { source: 'github-sync', label: 'GitHub' },
  { source: 'rss-sync', label: 'RSS' },
  { source: 'email-sync', label: 'Email' },
];

interface SourceFilterProps {
  activeFilter: AuditSource | 'all';
  onFilterChange: (filter: AuditSource | 'all') => void;
}

const SourceFilter: FC<SourceFilterProps> = ({ activeFilter, onFilterChange }) => (
  <div className="flex flex-wrap gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
    {SOURCE_FILTERS.map(({ source, label }) => (
      <button
        className={`rounded px-2 py-0.5 text-xs ${
          activeFilter === source
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
        }`}
        key={source}
        onClick={() => onFilterChange(source)}
      >
        {label}
      </button>
    ))}
  </div>
);

export interface AuditSidebarProps {
  /** Whether sidebar is visible */
  isOpen?: boolean;
  /** Callback when sidebar is toggled */
  onToggle?: (isOpen: boolean) => void;
}

/** Hook for handling audit entry clicks */
const useAuditEntryClick = () => {
  const { safeDb } = usePouchDb();
  const { openTodo } = useTodoFlyoutContext();

  return useCallback(
    async (entityId: string) => {
      const todo = await safeDb.safeGet<Todo>(entityId);
      if (todo) {
        openTodo(todo);
      }
    },
    [safeDb, openTodo],
  );
};

/** Determine deleted entity IDs from audit entries */
const getDeletedEntityIds = (entries: readonly AuditLogAlpha1[]): Set<string> => {
  return new Set(entries.filter((e) => e.action === 'delete').map((e) => e.entityId));
};

interface EntryListProps {
  entries: readonly AuditLogAlpha1[];
  deletedEntityIds: Set<string>;
  isLoading: boolean;
  sourceFilter: AuditSource | 'all';
  onEntryClick: (entityId: string) => void;
  onEntryHover: (entityId: string | null) => void;
}

/** List of audit entries */
const EntryList: FC<EntryListProps> = ({
  entries,
  deletedEntityIds,
  isLoading,
  sourceFilter,
  onEntryClick,
  onEntryHover,
}) => {
  if (isLoading) return <LoadingSkeleton />;

  if (entries.length === 0) {
    const message = sourceFilter === 'all' ? 'No activity yet' : `No ${sourceFilter} activity`;
    return (
      <div className="p-3 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {message}
      </div>
    );
  }

  return (
    <>
      {entries.map((entry) => (
        <AuditEntryItem
          entry={entry}
          isDeleted={deletedEntityIds.has(entry.entityId)}
          key={entry._id}
          onEntryClick={onEntryClick}
          onEntryHover={onEntryHover}
        />
      ))}
    </>
  );
};

export const AuditSidebar: FC<AuditSidebarProps> = ({ isOpen = true, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(isOpen);
  const [sourceFilter, setSourceFilter] = useState<AuditSource | 'all'>('all');
  const { entries, isLoading, isConnected } = useAuditLog({ enabled: isExpanded });
  const handleEntryClick = useAuditEntryClick();
  const { setHighlightedTodoId } = useHighlightContext();

  const filteredEntries =
    sourceFilter === 'all' ? entries : entries.filter((e) => e.source === sourceFilter);
  const deletedEntityIds = getDeletedEntityIds(entries);

  const handleToggle = (expanded: boolean) => {
    setIsExpanded(expanded);
    onToggle?.(expanded);
  };

  const handleEntryHover = useCallback(
    (entityId: string | null) => setHighlightedTodoId(entityId),
    [setHighlightedTodoId],
  );

  if (!isExpanded) return <CollapsedToggle onClick={() => handleToggle(true)} />;

  return (
    <aside
      className="sticky top-0 flex h-screen flex-col border-l border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
      style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
    >
      <SidebarHeader isConnected={isConnected} onCollapse={() => handleToggle(false)} />
      <SourceFilter activeFilter={sourceFilter} onFilterChange={setSourceFilter} />
      <div className="flex-1 overflow-y-auto">
        <EntryList
          deletedEntityIds={deletedEntityIds}
          entries={filteredEntries}
          isLoading={isLoading}
          onEntryClick={handleEntryClick}
          onEntryHover={handleEntryHover}
          sourceFilter={sourceFilter}
        />
      </div>
      {!isLoading && filteredEntries.length > 0 && (
        <div className="border-t border-neutral-200 px-3 py-2 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Showing last {Math.min(filteredEntries.length, MAX_DISPLAY_ENTRIES)} activities
        </div>
      )}
    </aside>
  );
};
