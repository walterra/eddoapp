/**
 * Helper functions for the audit sidebar.
 */
import type { AuditLogAlpha1 } from '@eddo/core-shared';

/** Determine deleted entity IDs from audit entries */
export function getDeletedEntityIds(entries: readonly AuditLogAlpha1[]): Set<string> {
  return new Set(entries.filter((e) => e.action === 'delete').map((e) => e.entityId));
}

/** Format relative time (e.g., "2 min ago") */
export function formatRelativeTime(timestamp: string): string {
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
export function getEntryTitle(entry: AuditLogAlpha1): string {
  const after = entry.after as { title?: string } | undefined;
  const before = entry.before as { title?: string } | undefined;
  return after?.title || before?.title || entry.entityId.slice(0, 16) + '...';
}
