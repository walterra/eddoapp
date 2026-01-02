/**
 * Database Setup Utilities
 * Handles design document creation and database schema management
 * Separated from MCP server for better architecture and test isolation
 */
import { getCouchDbConfig, validateEnv } from '@eddo/core-server';
import { DESIGN_DOCS, type DesignDocument, REQUIRED_INDEXES } from '@eddo/core-shared';
import nano from 'nano';

export class DatabaseSetup {
  private couch: ReturnType<typeof nano>;
  private db: ReturnType<ReturnType<typeof nano>['db']['use']>;
  private dbName: string;

  constructor(customDbName?: string) {
    const env = validateEnv(process.env);
    const couchDbConfig = getCouchDbConfig(env);
    this.couch = nano(couchDbConfig.url);

    // Use custom database name for test isolation, or fall back to config
    this.dbName = customDbName || couchDbConfig.dbName;
    this.db = this.couch.db.use(this.dbName);

    console.log(`🏗️  DatabaseSetup initialized with database: ${this.dbName}`);
  }

  /**
   * Create all required design documents for the application
   */
  async createDesignDocuments(): Promise<void> {
    console.log(`🏗️  Setting up design documents for: ${this.dbName}`);

    for (const designDoc of DESIGN_DOCS) {
      await this.createDesignDocument(designDoc);
    }

    console.log(`✅ All design documents created for: ${this.dbName}`);
  }

  /**
   * Check if error is a CouchDB conflict (409)
   */
  private isConflictError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 409
    );
  }

  /**
   * Update existing design document with current revision
   */
  private async updateExistingDesignDoc(
    designDoc: DesignDocument,
    attempt: number,
    maxRetries: number,
  ): Promise<boolean> {
    try {
      const existingDoc = await this.db.get(designDoc._id);
      const updatedDoc = {
        ...designDoc,
        _rev: (existingDoc as { _rev: string })._rev,
      };
      await this.db.insert(updatedDoc);
      console.log(`🔄 Updated design document: ${designDoc._id}`);
      return true;
    } catch (updateError: unknown) {
      if (this.isConflictError(updateError) && attempt < maxRetries) {
        console.warn(
          `⚠️  Document conflict for ${designDoc._id}, attempt ${attempt}/${maxRetries}, retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        return false;
      }
      console.error(`❌ Failed to update design document ${designDoc._id}:`, updateError);
      throw updateError;
    }
  }

  /**
   * Create or update a single design document with retry logic
   */
  async createDesignDocument(designDoc: DesignDocument, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.db.insert(designDoc);
        console.log(`✅ Created design document: ${designDoc._id}`);
        return;
      } catch (error: unknown) {
        if (this.isConflictError(error)) {
          const updated = await this.updateExistingDesignDoc(designDoc, attempt, maxRetries);
          if (updated) return;
          continue;
        }
        console.error(`❌ Failed to create design document ${designDoc._id}:`, error);
        throw error;
      }
    }
  }

  /**
   * Create CouchDB indexes for efficient querying
   * Uses shared REQUIRED_INDEXES from @eddo/core-shared for consistency
   */
  async createIndexes(): Promise<void> {
    console.log(`🔍 Creating indexes for: ${this.dbName}`);

    for (const indexDef of REQUIRED_INDEXES) {
      await this.createSingleIndexWithRetry(indexDef);
    }

    console.log(`✅ Indexes created for: ${this.dbName}`);
  }

  /**
   * Check if error indicates index already exists
   */
  private isIndexExistsError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 409
    );
  }

  /**
   * Check if error is retryable (database not ready or conflict)
   */
  private isRetryableIndexError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) {
      return false;
    }
    if (error.statusCode === 404) {
      return true;
    }
    if (
      error.statusCode === 500 &&
      'reason' in error &&
      typeof error.reason === 'string' &&
      error.reason.includes('conflict')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Handle index creation error with retry logic
   * @returns true if should retry, false if handled
   */
  private async handleIndexCreationError(
    error: unknown,
    indexName: string,
    attempt: number,
    maxRetries: number,
  ): Promise<boolean> {
    if (this.isIndexExistsError(error)) {
      console.log(`ℹ️  Index ${indexName} already exists`);
      return false;
    }

    if (this.isRetryableIndexError(error)) {
      if (attempt === maxRetries) {
        console.error(
          `❌ Failed to create index ${indexName} after ${maxRetries} attempts:`,
          error,
        );
        throw error;
      }
      console.warn(
        `⚠️  Attempt ${attempt}/${maxRetries} failed for index ${indexName}, retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      return true;
    }

    console.error(`❌ Failed to create index ${indexName}:`, error);
    throw error;
  }

  private async createSingleIndexWithRetry(
    indexDef: {
      index: { fields: string[] };
      name: string;
      type: 'json' | 'text';
    },
    maxRetries: number = 5,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.db.createIndex(indexDef);
        console.log(`✅ Created index: ${indexDef.name}`);
        return;
      } catch (error: unknown) {
        const shouldRetry = await this.handleIndexCreationError(
          error,
          indexDef.name,
          attempt,
          maxRetries,
        );
        if (!shouldRetry) return;
      }
    }
  }

  /**
   * Complete database setup: create database, indexes, and design documents
   */
  async setupDatabase(): Promise<void> {
    console.log(`🚀 Setting up database: ${this.dbName}`);

    // Create database if it doesn't exist
    try {
      await this.couch.db.create(this.dbName);
      console.log(`🏗️  Created database: ${this.dbName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 412) {
        console.log(`ℹ️  Database already exists: ${this.dbName}`);
      } else {
        throw error;
      }
    }

    // Create indexes
    await this.createIndexes();

    // Create design documents
    await this.createDesignDocuments();

    console.log(`🎉 Database setup complete: ${this.dbName}`);
  }

  /**
   * Completely reset database: destroy, recreate, and set up
   */
  async resetDatabase(): Promise<void> {
    console.log(`🔄 Resetting database: ${this.dbName}`);

    // Destroy database
    try {
      await this.couch.db.destroy(this.dbName);
      console.log(`🗑️  Destroyed database: ${this.dbName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        console.log(`ℹ️  Database ${this.dbName} doesn't exist`);
      } else {
        console.warn(`Warning: Failed to destroy database ${this.dbName}:`, error);
      }
    }

    // Wait for destruction to complete and verify
    await this.waitForDatabaseDestruction();

    // Recreate and set up
    await this.setupDatabase();

    console.log(`✅ Database reset complete: ${this.dbName}`);
  }

  /**
   * Wait for database destruction to complete
   */
  private async waitForDatabaseDestruction(maxRetries: number = 15): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.couch.db.get(this.dbName);
        // Database still exists, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 404
        ) {
          // Database doesn't exist - destruction complete
          console.log(`✅ Database destruction verified: ${this.dbName}`);
          // Add extra delay to ensure CouchDB has fully processed the deletion
          await new Promise((resolve) => setTimeout(resolve, 500));
          return;
        } else {
          throw error;
        }
      }
    }
    console.warn(`⚠️  Database destruction verification timed out for: ${this.dbName}`);
  }

  /**
   * Verify database is properly set up with all design documents
   */
  async verifySetup(): Promise<void> {
    const info = await this.db.info();
    console.log(`📊 Database info: ${info.db_name} (${info.doc_count} docs)`);

    // Check that tag statistics design document exists
    try {
      await this.db.get('_design/tags');
      console.log(`✅ Tag statistics design document exists`);
    } catch (_error) {
      throw new Error('Tag statistics design document missing');
    }
  }
}
