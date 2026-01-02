#!/usr/bin/env tsx
/**
 * Standalone Database Setup Service
 * Handles database creation, indexes, and design documents
 * Can be used in production, development, and CI/CD pipelines
 */
import { validateEnv } from '@eddo/core-server';
import { dotenvLoad } from 'dotenv-mono';

import { DatabaseSetup } from '../integration-tests/setup/database-setup.js';

dotenvLoad();

/** Print usage help */
function printUsage(): void {
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
  COUCHDB_DB_NAME       - Database name (same for all environments with testcontainers)
  `);
  process.exit(1);
}

/** Execute a database command */
async function executeCommand(dbSetup: DatabaseSetup, command: string): Promise<void> {
  switch (command) {
    case 'setup':
      console.log('🚀 Setting up database with indexes and design documents...');
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
      printUsage();
  }
}

async function main() {
  const command = process.argv[2] || 'setup';
  const env = validateEnv(process.env);

  console.log('🗄️  Eddo Database Setup Service');
  console.log(`📋 Command: ${command}`);
  console.log(`🌍 Environment: ${env.NODE_ENV || 'development'}`);

  try {
    await executeCommand(new DatabaseSetup(), command);
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
