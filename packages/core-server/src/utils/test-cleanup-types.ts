/**
 * Type definitions for test cleanup utilities
 */
import type { Env } from '../config/env';

/** Options for test cleanup operations */
export interface TestCleanupOptions {
  /** Environment configuration */
  env?: Env;
  /** Dry run mode - show what would be cleaned up without actually deleting */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Maximum age of databases to clean up (in hours) */
  maxAge?: number;
  /** Force cleanup even if databases might be in use */
  force?: boolean;
}

/** Result of a cleanup operation */
export interface CleanupResult {
  /** Databases that were cleaned up */
  cleaned: string[];
  /** Databases that were skipped */
  skipped: string[];
  /** Errors encountered during cleanup */
  errors: Array<{ database: string; error: string }>;
  /** Summary of cleanup operation */
  summary: { total: number; cleaned: number; skipped: number; errors: number };
}

/** Information about a database */
export interface DatabaseInfo {
  name: string;
  type: 'user' | 'user_registry' | 'test' | 'api_keyed' | 'unknown';
  username?: string;
  prefix?: string;
  apiKey?: string;
  created?: Date;
  isTestDatabase: boolean;
}

/** Required options with defaults applied */
export type RequiredCleanupOptions = Required<TestCleanupOptions>;

/** Create default cleanup result */
export const createEmptyCleanupResult = (): CleanupResult => ({
  cleaned: [],
  skipped: [],
  errors: [],
  summary: { total: 0, cleaned: 0, skipped: 0, errors: 0 },
});
