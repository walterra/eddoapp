/**
 * Extended sync helper functions for GitHub issue sync
 */
import type { SyncLogger } from './sync-helpers.js';

interface SyncStats {
  created: number;
  updated: number;
  completed: number;
}

/**
 * Initializes sync stats counter
 */
export function createSyncStats(): SyncStats {
  return { created: 0, updated: 0, completed: 0 };
}

type ProcessIssueResult = 'created' | 'updated' | 'completed' | 'skipped' | 'unchanged';

/**
 * Increments the appropriate sync stat counter
 * @param stats - Stats object to update
 * @param result - Result type from processing
 */
export function incrementStat(stats: SyncStats, result: ProcessIssueResult): void {
  if (result === 'created') stats.created++;
  else if (result === 'updated') stats.updated++;
  else if (result === 'completed') stats.completed++;
}

interface UserSyncInfo {
  userId: string;
  username: string;
  isInitialSync: boolean;
  lastSync?: string;
}

/**
 * Logs start of sync for user
 * @param logger - Logger instance
 * @param info - User sync info
 */
export function logSyncStart(logger: SyncLogger, info: UserSyncInfo): void {
  logger.info('Starting GitHub sync for user', {
    userId: info.userId,
    username: info.username,
    isInitialSync: info.isInitialSync,
  });
}

/**
 * Logs successful sync completion
 * @param logger - Logger instance
 * @param info - User sync info
 * @param stats - Sync statistics
 * @param totalIssues - Total issues processed
 */
export function logSyncComplete(
  logger: SyncLogger,
  info: UserSyncInfo,
  stats: SyncStats,
  totalIssues: number,
): void {
  logger.info('Successfully synced GitHub issues for user', {
    userId: info.userId,
    username: info.username,
    isInitialSync: info.isInitialSync,
    issueState: info.isInitialSync ? 'open' : 'all',
    since: info.isInitialSync ? 'none' : info.lastSync || 'none',
    totalIssues,
    created: stats.created,
    updated: stats.updated,
    completed: stats.completed,
  });
}

interface FetchOptions {
  isInitialSync: boolean;
  lastSync?: string;
}

/**
 * Creates fetch options based on sync state
 * @param options - Fetch options
 * @returns GitHub API fetch parameters
 */
export function createFetchOptions(options: FetchOptions): {
  state: 'open' | 'all';
  since?: string;
} {
  return {
    state: options.isInitialSync ? 'open' : 'all',
    since: options.isInitialSync ? undefined : options.lastSync,
  };
}
