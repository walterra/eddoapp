/**
 * Database Setup Utilities
 * Handles design document creation and database schema management
 * Separated from MCP server for better architecture and test isolation
 */
import { getTestCouchDbConfig, validateEnv } from '@eddo/core-server';
import nano from 'nano';

export interface DesignDocument {
  _id: string;
  views?: Record<string, { map: string; reduce?: string }>;
}

export const TAG_STATISTICS_DESIGN_DOC: DesignDocument = {
  _id: '_design/tags',
  views: {
    by_tag: {
      map: `function(doc) {
        if (doc.version === 'alpha3' && doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0) {
          for (var i = 0; i < doc.tags.length; i++) {
            emit(doc.tags[i], 1);
          }
        }
      }`,
      reduce: '_count',
    },
  },
};

export class DatabaseSetup {
  private couch: ReturnType<typeof nano>;
  private db: ReturnType<ReturnType<typeof nano>['db']['use']>;
  private dbName: string;

  constructor(customDbName?: string) {
    const env = validateEnv(process.env);
    const couchDbConfig = getTestCouchDbConfig(env);
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

    await this.createDesignDocument(TAG_STATISTICS_DESIGN_DOC);

    // Add more design documents here as needed

    console.log(`✅ All design documents created for: ${this.dbName}`);
  }

  /**
   * Create or update a single design document with retry logic
   */
  async createDesignDocument(
    designDoc: DesignDocument,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.db.insert(designDoc);
        console.log(`✅ Created design document: ${designDoc._id}`);
        return;
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 409
        ) {
          // Design document exists, try to update it
          try {
            const existingDoc = await this.db.get(designDoc._id);
            const updatedDoc = {
              ...designDoc,
              _rev: (existingDoc as { _rev: string })._rev,
            };
            await this.db.insert(updatedDoc);
            console.log(`🔄 Updated design document: ${designDoc._id}`);
            return;
          } catch (updateError: unknown) {
            if (
              updateError &&
              typeof updateError === 'object' &&
              'statusCode' in updateError &&
              updateError.statusCode === 409 &&
              attempt < maxRetries
            ) {
              // Document update conflict - retry after delay
              console.warn(
                `⚠️  Document conflict for ${designDoc._id}, attempt ${attempt}/${maxRetries}, retrying...`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 200 * attempt),
              );
              continue;
            } else {
              console.error(
                `❌ Failed to update design document ${designDoc._id}:`,
                updateError,
              );
              throw updateError;
            }
          }
        } else {
          console.error(
            `❌ Failed to create design document ${designDoc._id}:`,
            error,
          );
          throw error;
        }
      }
    }
  }

  /**
   * Create CouchDB indexes for efficient querying
   */
  async createIndexes(): Promise<void> {
    console.log(`🔍 Creating indexes for: ${this.dbName}`);

    // Try a very simple index first to test if indexing works at all
    const simpleIndex = {
      index: { fields: ['due'] },
      name: 'simple-due-index',
      type: 'json' as const,
    };

    try {
      await this.db.createIndex(simpleIndex);
      console.log(`✅ Created simple index: ${simpleIndex.name}`);
    } catch (error) {
      console.error(`❌ Failed to create simple index:`, error);
    }

    const indexes: Array<{
      index: { fields: string[] };
      name: string;
      type: 'json' | 'text';
    }> = [
      // Primary index for basic queries with sort
      {
        index: { fields: ['version', 'due'] },
        name: 'version-due-index',
        type: 'json',
      },
      // Index for context filtering with sort
      {
        index: { fields: ['version', 'context', 'due'] },
        name: 'version-context-due-index',
        type: 'json',
      },
      // Index for completion filtering with sort
      {
        index: { fields: ['version', 'completed', 'due'] },
        name: 'version-completed-due-index',
        type: 'json',
      },
      // Index for both context and completion filtering with sort
      {
        index: { fields: ['version', 'context', 'completed', 'due'] },
        name: 'version-context-completed-due-index',
        type: 'json',
      },
    ];

    for (const indexDef of indexes) {
      await this.createSingleIndexWithRetry(indexDef);
    }

    console.log(`✅ Indexes created for: ${this.dbName}`);
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
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 409
        ) {
          console.log(`ℹ️  Index ${indexDef.name} already exists`);
          return;
        } else if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          (error.statusCode === 404 ||
            (error.statusCode === 500 &&
              'reason' in error &&
              typeof error.reason === 'string' &&
              error.reason.includes('conflict')))
        ) {
          // Database doesn't exist or conflict - retry with delay
          if (attempt === maxRetries) {
            console.error(
              `❌ Failed to create index ${indexDef.name} after ${maxRetries} attempts:`,
              error,
            );
            throw error;
          }
          console.warn(
            `⚠️  Attempt ${attempt}/${maxRetries} failed for index ${indexDef.name}, retrying...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        } else {
          console.error(`❌ Failed to create index ${indexDef.name}:`, error);
          throw error;
        }
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
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 412
      ) {
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
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        console.log(`ℹ️  Database ${this.dbName} doesn't exist`);
      } else {
        console.warn(
          `Warning: Failed to destroy database ${this.dbName}:`,
          error,
        );
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
  private async waitForDatabaseDestruction(
    maxRetries: number = 10,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.couch.db.get(this.dbName);
        // Database still exists, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 404
        ) {
          // Database doesn't exist - destruction complete
          console.log(`✅ Database destruction verified: ${this.dbName}`);
          return;
        } else {
          throw error;
        }
      }
    }
    console.warn(
      `⚠️  Database destruction verification timed out for: ${this.dbName}`,
    );
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
