#!/usr/bin/env tsx
/**
 * Standalone Database Setup Service
 * Handles database creation, indexes, and design documents
 * Can be used in production, development, and CI/CD pipelines
 */
import { validateEnv } from '@eddo/core';
import { dotenvLoad } from 'dotenv-mono';

import { DatabaseSetup } from '../integration-tests/setup/database-setup.js';

dotenvLoad();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const env = validateEnv(process.env);

  console.log('🗄️  Eddo Database Setup Service');
  console.log(`📋 Command: ${command || 'setup'}`);
  console.log(`🌍 Environment: ${env.NODE_ENV || 'development'}`);

  const dbSetup = new DatabaseSetup();

  try {
    switch (command) {
      case 'setup':
        console.log(
          '🚀 Setting up database with indexes and design documents...',
        );
        await dbSetup.setupDatabase();
        console.log('✅ Database setup complete');
        break;

      case 'reset':
        console.log('🔄 Resetting database (destroy and recreate)...');
        await dbSetup.resetDatabase();
        console.log('✅ Database reset complete');
        break;

      case 'verify':
        console.log('🔍 Verifying database setup...');
        await dbSetup.verifySetup();
        console.log('✅ Database verification complete');
        break;

      case 'design-docs':
        console.log('📄 Creating design documents...');
        await dbSetup.createDesignDocuments();
        console.log('✅ Design documents created');
        break;

      case 'indexes':
        console.log('🔍 Creating indexes...');
        await dbSetup.createIndexes();
        console.log('✅ Indexes created');
        break;

      default:
        console.log(`
Usage: tsx setup-database.ts [command]

Commands:
  setup        - Complete database setup (default)
  reset        - Reset database (destroy and recreate)
  verify       - Verify database is properly set up
  design-docs  - Create only design documents
  indexes      - Create only indexes

Environment Variables:
  NODE_ENV               - Environment (development/test/production)
  COUCHDB_URL           - CouchDB server URL
  COUCHDB_DB_NAME       - Database name
  COUCHDB_TEST_DB_NAME  - Test database name (when NODE_ENV=test)
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as setupDatabase };
