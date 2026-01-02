/**
 * E2E Test Utilities
 * Provides helper functions for setting up and cleaning up CouchDB databases in e2e tests
 */
import { cleanupDatabasesByPattern, getCouchDbConfig, validateEnv } from '@eddo/core-server';
import nano from 'nano';

/**
 * Generate a unique test database name to avoid conflicts between tests
 */
export function generateTestDbName(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${prefix}-${timestamp}-${random}`;
}

/**
 * Create test environment configuration with CouchDB settings
 */
export function createTestEnv(customDbName?: string) {
  const env = validateEnv(process.env);
  const testCouchConfig = getCouchDbConfig(env);

  return {
    ...process.env,
    COUCHDB_URL: testCouchConfig.url,
    COUCHDB_DB_NAME: customDbName || testCouchConfig.dbName,
  };
}

/**
 * Get CouchDB URL for CLI scripts that use --url flag
 */
export function getCouchDbUrl(): string {
  const env = validateEnv(process.env);
  const testCouchConfig = getCouchDbConfig(env);
  return testCouchConfig.url;
}

/**
 * Database cleanup utility for e2e tests
 */
export class TestDatabaseManager {
  private couch: ReturnType<typeof nano>;
  private createdDatabases: Set<string> = new Set();

  constructor() {
    const env = validateEnv(process.env);
    const testCouchConfig = getCouchDbConfig(env);
    this.couch = nano(testCouchConfig.url);
  }

  /**
   * Create a test database and track it for cleanup
   */
  async createTestDatabase(dbName: string): Promise<void> {
    try {
      await this.couch.db.create(dbName);
      this.createdDatabases.add(dbName);
      console.log(`📁 Created test database: ${dbName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 412) {
        // Database already exists
        this.createdDatabases.add(dbName);
        console.log(`📁 Test database already exists: ${dbName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Track a database name for cleanup (useful for databases created by external scripts)
   */
  trackDatabase(dbName: string): void {
    this.createdDatabases.add(dbName);
    console.log(`📋 Tracking database for cleanup: ${dbName}`);
  }

  /**
   * Delete a specific test database
   */
  async deleteTestDatabase(dbName: string): Promise<void> {
    try {
      await this.couch.db.destroy(dbName);
      this.createdDatabases.delete(dbName);
      console.log(`🗑️  Deleted test database: ${dbName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        // Database doesn't exist
        console.log(`ℹ️  Test database doesn't exist: ${dbName}`);
      } else {
        console.warn(`⚠️  Failed to delete test database ${dbName}:`, error);
      }
    }
  }

  /**
   * Clean up all created test databases
   */
  async cleanupAll(): Promise<void> {
    const dbNames = Array.from(this.createdDatabases);
    for (const dbName of dbNames) {
      await this.deleteTestDatabase(dbName);
    }
    this.createdDatabases.clear();
  }

  /**
   * Clean up all test databases matching pattern, including untracked ones
   * This is useful for cleaning up databases created by external scripts
   */
  async cleanupAllTestDatabases(
    options: { dryRun?: boolean; verbose?: boolean } = {},
  ): Promise<void> {
    try {
      // Clean up tracked databases first
      await this.cleanupAll();

      // Clean up any remaining test databases using pattern matching
      const testDatabasePattern = /^test-/;
      const result = await cleanupDatabasesByPattern(testDatabasePattern, {
        dryRun: options.dryRun || false,
        verbose: options.verbose || false,
        force: true, // Force cleanup for test databases
      });

      if (options.verbose) {
        console.log(`🧹 Pattern-based cleanup completed:`);
        console.log(`  Cleaned: ${result.summary.cleaned}`);
        console.log(`  Skipped: ${result.summary.skipped}`);
        console.log(`  Errors: ${result.summary.errors}`);
      }

      if (result.errors.length > 0) {
        console.warn(`⚠️  Some databases could not be cleaned up:`, result.errors);
      }
    } catch (error) {
      console.error('❌ Error during comprehensive test database cleanup:', error);
      throw error;
    }
  }

  /** Check if error is a CouchDB 404 */
  private isNotFoundError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    );
  }

  /** Wait with exponential backoff */
  private async waitWithBackoff(attempt: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
  }

  /** Check database existence and return result */
  private async checkDatabaseState(dbName: string): Promise<'exists' | 'not_found' | 'error'> {
    try {
      await this.couch.db.get(dbName);
      return 'exists';
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) return 'not_found';
      throw error;
    }
  }

  /**
   * Wait for database to be fully created/deleted (useful for timing-sensitive tests)
   */
  async waitForDatabase(
    dbName: string,
    shouldExist: boolean,
    maxRetries: number = 10,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const state = await this.checkDatabaseState(dbName);
      if (state === 'exists' && shouldExist) return;
      if (state === 'not_found' && !shouldExist) return;
      await this.waitWithBackoff(attempt);
    }
    throw new Error(
      `Database ${dbName} ${shouldExist ? 'creation' : 'deletion'} verification timed out`,
    );
  }

  /**
   * Add sample data to a test database
   */
  async addSampleData(dbName: string, docs: Record<string, unknown>[]): Promise<void> {
    const db = this.couch.db.use(dbName);
    for (const doc of docs) {
      try {
        await db.insert(doc);
      } catch (error) {
        console.warn(`⚠️  Failed to insert document ${doc._id}:`, error);
      }
    }
    console.log(`📋 Added ${docs.length} sample documents to ${dbName}`);
  }

  /**
   * Check if a database exists
   */
  async databaseExists(dbName: string): Promise<boolean> {
    try {
      await this.couch.db.get(dbName);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get the list of databases that match test pattern
   */
  async getTestDatabases(): Promise<string[]> {
    try {
      const allDbs = await this.couch.db.list();
      return allDbs.filter((db) => db.startsWith('test-'));
    } catch (error) {
      console.warn('⚠️  Failed to list databases:', error);
      return [];
    }
  }
}

/**
 * Sample todo documents for testing backup/restore operations
 */
export const SAMPLE_TODO_DOCS = [
  {
    _id: '2025-06-29T10:00:00.000Z',
    title: 'E2E Test Todo 1',
    description: 'Testing backup functionality',
    completed: null,
    context: 'work',
    due: '2025-06-30',
    tags: ['testing', 'e2e'],
    active: {},
    repeat: null,
    link: null,
    version: 'alpha3' as const,
  },
  {
    _id: '2025-06-29T11:00:00.000Z',
    title: 'E2E Test Todo 2',
    description: 'Testing restore functionality',
    completed: null,
    context: 'personal',
    due: '2025-07-01',
    tags: ['testing'],
    active: {},
    repeat: 7,
    link: 'https://example.com',
    version: 'alpha3' as const,
  },
  {
    _id: '2025-06-29T12:00:00.000Z',
    title: 'Completed E2E Test Todo',
    description: 'Testing completed todo backup',
    completed: '2025-06-29T13:00:00.000Z',
    context: 'work',
    due: '2025-06-29',
    tags: ['testing', 'completed'],
    active: {},
    repeat: null,
    link: null,
    version: 'alpha3' as const,
  },
];
