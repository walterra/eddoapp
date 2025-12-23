/**
 * Database cleanup utilities for test environments
 * Handles cleanup of CouchDB databases created during testing
 */
import nano from 'nano';

import type { Env } from '../config/env';
import { createEnv, getCouchDbConfig } from '../config/env';
import {
  extractUsernameFromDatabaseName,
  getDatabasePrefix,
  isUserDatabase,
  isUserRegistryDatabase,
} from './database-names';

export interface TestCleanupOptions {
  /**
   * Environment configuration
   */
  env?: Env;
  /**
   * Dry run mode - show what would be cleaned up without actually deleting
   */
  dryRun?: boolean;
  /**
   * Verbose logging
   */
  verbose?: boolean;
  /**
   * Maximum age of databases to clean up (in hours)
   */
  maxAge?: number;
  /**
   * Force cleanup even if databases might be in use
   */
  force?: boolean;
}

export interface CleanupResult {
  /**
   * Databases that were cleaned up
   */
  cleaned: string[];
  /**
   * Databases that were skipped
   */
  skipped: string[];
  /**
   * Errors encountered during cleanup
   */
  errors: Array<{ database: string; error: string }>;
  /**
   * Summary of cleanup operation
   */
  summary: {
    total: number;
    cleaned: number;
    skipped: number;
    errors: number;
  };
}

export interface DatabaseInfo {
  name: string;
  type: 'user' | 'user_registry' | 'test' | 'api_keyed' | 'unknown';
  username?: string;
  prefix?: string;
  apiKey?: string;
  created?: Date;
  isTestDatabase: boolean;
}

/**
 * Comprehensive database cleanup utility for test environments
 */
export class TestDatabaseCleanup {
  private couch: ReturnType<typeof nano>;
  private env: Env;
  private options: Required<TestCleanupOptions>;

  constructor(options: TestCleanupOptions = {}) {
    this.env = options.env || createEnv();
    this.options = {
      env: this.env,
      dryRun: false,
      verbose: false,
      maxAge: 24, // 24 hours default
      force: false,
      ...options,
    };

    const testCouchConfig = getCouchDbConfig(this.env);
    this.couch = nano(testCouchConfig.url);
  }

  /**
   * Get all databases from CouchDB server
   */
  async getAllDatabases(): Promise<string[]> {
    try {
      const databases = await this.couch.db.list();
      return databases.filter((db) => !db.startsWith('_')); // Filter out system databases
    } catch (error) {
      this.log('Error fetching databases:', error);
      return [];
    }
  }

  /**
   * Classify a database by type and extract metadata
   */
  classifyDatabase(databaseName: string): DatabaseInfo {
    const info: DatabaseInfo = {
      name: databaseName,
      type: 'unknown',
      isTestDatabase: false,
    };

    // Check if it's a user database
    if (isUserDatabase(databaseName, this.env)) {
      info.type = 'user';
      info.username = extractUsernameFromDatabaseName(databaseName, this.env) || undefined;
      info.prefix = getDatabasePrefix(this.env);
      info.isTestDatabase = this.env.NODE_ENV === 'test' || databaseName.includes('test');
      return info;
    }

    // Check if it's a user registry database
    if (isUserRegistryDatabase(databaseName, this.env)) {
      info.type = 'user_registry';
      info.prefix = getDatabasePrefix(this.env);
      info.isTestDatabase = this.env.NODE_ENV === 'test' || databaseName.includes('test');
      return info;
    }

    // Check for test database patterns
    if (databaseName.startsWith('test-')) {
      info.type = 'test';
      info.isTestDatabase = true;
      return info;
    }

    // Check for API-keyed databases
    if (databaseName.includes('_api_')) {
      info.type = 'api_keyed';
      const parts = databaseName.split('_api_');
      if (parts.length === 2) {
        info.apiKey = parts[1];
      }
      info.isTestDatabase = databaseName.includes('test');
      return info;
    }

    // Check for test prefixes
    if (databaseName.startsWith(this.env.DATABASE_TEST_PREFIX)) {
      info.isTestDatabase = true;
      info.prefix = this.env.DATABASE_TEST_PREFIX;
    }

    return info;
  }

  /**
   * Get database creation time (approximated from database info)
   */
  async getDatabaseCreationTime(databaseName: string): Promise<Date | null> {
    try {
      const _dbInfo = await this.couch.db.get(databaseName);
      // CouchDB doesn't directly provide creation time, but we can use doc_count as a proxy
      // or check for design documents that might have timestamps
      return null; // Unable to determine creation time reliably
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check if a database is safe to delete
   */
  async isSafeToDelete(info: DatabaseInfo): Promise<boolean> {
    // Never delete production databases
    if (!info.isTestDatabase && this.env.NODE_ENV === 'production') {
      return false;
    }

    // Only delete test databases or databases with test prefixes
    if (!info.isTestDatabase && !this.options.force) {
      return false;
    }

    // Check if database is currently in use (basic check)
    if (!this.options.force) {
      try {
        const dbInfo = await this.couch.db.get(info.name);
        // If database has recent activity, be cautious
        if (dbInfo.doc_count > 0) {
          this.log(
            `Database ${info.name} has ${dbInfo.doc_count} documents, skipping unless forced`,
          );
          return false;
        }
      } catch (_error) {
        // If we can't get database info, it might not exist or be inaccessible
        return true;
      }
    }

    return true;
  }

  /**
   * Delete a single database
   */
  async deleteDatabase(databaseName: string): Promise<boolean> {
    try {
      if (this.options.dryRun) {
        this.log(`[DRY RUN] Would delete database: ${databaseName}`);
        return true;
      }

      await this.couch.db.destroy(databaseName);
      this.log(`🗑️  Deleted database: ${databaseName}`);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        this.log(`ℹ️  Database ${databaseName} doesn't exist`);
        return true; // Consider it successful if it doesn't exist
      }
      this.log(`❌ Failed to delete database ${databaseName}:`, error);
      return false;
    }
  }

  /**
   * Clean up test databases based on patterns
   */
  async cleanupTestDatabases(): Promise<CleanupResult> {
    const result: CleanupResult = {
      cleaned: [],
      skipped: [],
      errors: [],
      summary: {
        total: 0,
        cleaned: 0,
        skipped: 0,
        errors: 0,
      },
    };

    try {
      const allDatabases = await this.getAllDatabases();
      result.summary.total = allDatabases.length;

      this.log(`Found ${allDatabases.length} databases to analyze`);

      for (const dbName of allDatabases) {
        const info = this.classifyDatabase(dbName);

        this.log(
          `Analyzing database: ${dbName} (type: ${info.type}, isTest: ${info.isTestDatabase})`,
        );

        if (!(await this.isSafeToDelete(info))) {
          result.skipped.push(dbName);
          result.summary.skipped++;
          continue;
        }

        const success = await this.deleteDatabase(dbName);
        if (success) {
          result.cleaned.push(dbName);
          result.summary.cleaned++;
        } else {
          result.errors.push({
            database: dbName,
            error: 'Failed to delete database',
          });
          result.summary.errors++;
        }
      }

      this.log(`\n📊 Cleanup Summary:`);
      this.log(`  Total databases analyzed: ${result.summary.total}`);
      this.log(`  Cleaned up: ${result.summary.cleaned}`);
      this.log(`  Skipped: ${result.summary.skipped}`);
      this.log(`  Errors: ${result.summary.errors}`);

      return result;
    } catch (error) {
      this.log('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up databases for a specific user
   */
  async cleanupUserDatabases(username: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      cleaned: [],
      skipped: [],
      errors: [],
      summary: {
        total: 0,
        cleaned: 0,
        skipped: 0,
        errors: 0,
      },
    };

    try {
      const allDatabases = await this.getAllDatabases();
      const userDatabases = allDatabases.filter((dbName) => {
        const info = this.classifyDatabase(dbName);
        return info.username === username;
      });

      result.summary.total = userDatabases.length;

      this.log(`Found ${userDatabases.length} databases for user: ${username}`);

      for (const dbName of userDatabases) {
        const info = this.classifyDatabase(dbName);

        if (!(await this.isSafeToDelete(info))) {
          result.skipped.push(dbName);
          result.summary.skipped++;
          continue;
        }

        const success = await this.deleteDatabase(dbName);
        if (success) {
          result.cleaned.push(dbName);
          result.summary.cleaned++;
        } else {
          result.errors.push({
            database: dbName,
            error: 'Failed to delete database',
          });
          result.summary.errors++;
        }
      }

      return result;
    } catch (error) {
      this.log('Error during user cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up databases matching specific patterns
   */
  async cleanupDatabasesByPattern(pattern: RegExp): Promise<CleanupResult> {
    const result: CleanupResult = {
      cleaned: [],
      skipped: [],
      errors: [],
      summary: {
        total: 0,
        cleaned: 0,
        skipped: 0,
        errors: 0,
      },
    };

    try {
      const allDatabases = await this.getAllDatabases();
      const matchingDatabases = allDatabases.filter((dbName) => pattern.test(dbName));

      result.summary.total = matchingDatabases.length;

      this.log(`Found ${matchingDatabases.length} databases matching pattern: ${pattern}`);

      for (const dbName of matchingDatabases) {
        const info = this.classifyDatabase(dbName);

        if (!(await this.isSafeToDelete(info))) {
          result.skipped.push(dbName);
          result.summary.skipped++;
          continue;
        }

        const success = await this.deleteDatabase(dbName);
        if (success) {
          result.cleaned.push(dbName);
          result.summary.cleaned++;
        } else {
          result.errors.push({
            database: dbName,
            error: 'Failed to delete database',
          });
          result.summary.errors++;
        }
      }

      return result;
    } catch (error) {
      this.log('Error during pattern cleanup:', error);
      throw error;
    }
  }

  /**
   * Get a report of all databases without cleaning them up
   */
  async getDatabaseReport(): Promise<DatabaseInfo[]> {
    try {
      const allDatabases = await this.getAllDatabases();
      return allDatabases.map((dbName) => this.classifyDatabase(dbName));
    } catch (error) {
      this.log('Error generating database report:', error);
      throw error;
    }
  }

  /**
   * Log message with optional verbose filtering
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.verbose) {
      console.log(message, ...args);
    }
  }
}

/**
 * Factory function to create a test cleanup instance
 */
export function createTestCleanup(options: TestCleanupOptions = {}): TestDatabaseCleanup {
  return new TestDatabaseCleanup(options);
}

/**
 * Quick cleanup function for common test scenarios
 */
export async function quickCleanup(options: TestCleanupOptions = {}): Promise<CleanupResult> {
  const cleanup = createTestCleanup(options);
  return await cleanup.cleanupTestDatabases();
}

/**
 * Cleanup databases for a specific user
 */
export async function cleanupUserDatabases(
  username: string,
  options: TestCleanupOptions = {},
): Promise<CleanupResult> {
  const cleanup = createTestCleanup(options);
  return await cleanup.cleanupUserDatabases(username);
}

/**
 * Cleanup databases matching a pattern
 */
export async function cleanupDatabasesByPattern(
  pattern: RegExp,
  options: TestCleanupOptions = {},
): Promise<CleanupResult> {
  const cleanup = createTestCleanup(options);
  return await cleanup.cleanupDatabasesByPattern(pattern);
}

/**
 * Get a report of all databases
 */
export async function getDatabaseReport(options: TestCleanupOptions = {}): Promise<DatabaseInfo[]> {
  const cleanup = createTestCleanup(options);
  return await cleanup.getDatabaseReport();
}

/**
 * Cleanup function specifically for CI/CD environments
 */
export async function cleanupCIEnvironment(
  options: TestCleanupOptions = {},
): Promise<CleanupResult> {
  const cleanup = createTestCleanup({
    ...options,
    force: true,
    verbose: true,
  });
  return await cleanup.cleanupTestDatabases();
}
