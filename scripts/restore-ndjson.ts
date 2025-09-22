#!/usr/bin/env tsx

/**
 * NDJSON restore script for CouchDB
 * Restores CouchDB database from a NDJSON (Newline Delimited JSON) backup file
 */

import fs from 'fs';
import { dotenvLoad } from 'dotenv-mono';
import { validateEnv, getCouchDbConfig } from '@eddo/core-server/config';
import {
  checkDatabaseExists,
  recreateDatabase,
  formatFileSize,
  type DatabaseInfo
} from './backup-utils.js';

// Load environment variables
dotenvLoad();

interface BulkDocsRequest {
  docs: unknown[];
}

interface BulkDocsResponse {
  id: string;
  rev?: string;
  error?: string;
  reason?: string;
}

/**
 * Parse NDJSON file and return array of documents
 */
function parseNdjsonFile(filePath: string): unknown[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`NDJSON file does not exist: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error(`NDJSON file is empty: ${filePath}`);
  }

  console.log(`Found ${lines.length} lines in NDJSON file`);

  const docs: unknown[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    try {
      const doc = JSON.parse(line);
      // Remove _rev field to avoid conflicts during insertion
      if (typeof doc === 'object' && doc !== null && '_rev' in doc) {
        delete (doc as { _rev?: string })._rev;
      }
      docs.push(doc);
    } catch (error) {
      const errorMsg = `Line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
    }
  });

  if (errors.length > 0) {
    console.error(`Found ${errors.length} malformed JSON lines:`);
    errors.slice(0, 5).forEach(err => console.error(`  ${err}`));
    if (errors.length > 5) {
      console.error(`  ... and ${errors.length - 5} more errors`);
    }
    throw new Error(`NDJSON file contains malformed JSON lines`);
  }

  console.log(`Successfully parsed ${docs.length} documents from NDJSON`);
  return docs;
}

/**
 * Extract credentials and create proper headers
 */
function getAuthHeaders(couchConfig: ReturnType<typeof getCouchDbConfig>): Record<string, string> {
  const url = new URL(couchConfig.url);
  if (url.username && url.password) {
    const auth = Buffer.from(`${url.username}:${url.password}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Get clean URL without credentials
 */
function getCleanUrl(dbName: string, couchConfig: ReturnType<typeof getCouchDbConfig>): string {
  const url = new URL(couchConfig.url);
  url.username = '';
  url.password = '';
  return `${url.origin}/${dbName}`;
}

/**
 * Perform bulk insert of documents using CouchDB _bulk_docs endpoint
 */
async function bulkInsertDocuments(docs: unknown[], dbName: string, couchConfig: ReturnType<typeof getCouchDbConfig>): Promise<void> {
  const bulkDoc: BulkDocsRequest = {
    docs: docs
  };

  const cleanUrl = getCleanUrl(dbName, couchConfig);
  const headers = getAuthHeaders(couchConfig);

  console.log(`Inserting ${docs.length} documents using CouchDB _bulk_docs endpoint...`);

  const response = await fetch(`${cleanUrl}/_bulk_docs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bulkDoc)
  });

  if (!response.ok) {
    throw new Error(`Bulk insert failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as BulkDocsResponse[];

  // Check for individual document errors
  const errors = result.filter(doc => doc.error);
  const successes = result.filter(doc => !doc.error);

  if (errors.length > 0) {
    console.error(`${errors.length} documents failed to insert:`);
    errors.slice(0, 5).forEach(err => {
      console.error(`  ID: ${err.id}, Error: ${err.error}, Reason: ${err.reason}`);
    });
    if (errors.length > 5) {
      console.error(`  ... and ${errors.length - 5} more errors`);
    }
  }

  console.log(`Successfully inserted ${successes.length} documents`);

  if (errors.length > 0) {
    throw new Error(`${errors.length} documents failed to insert`);
  }
}

/**
 * Main restore function
 */
async function restoreNdjson(ndjsonFile: string, database?: string, force: boolean = false): Promise<void> {
  try {
    // Check file exists first before environment validation
    if (!fs.existsSync(ndjsonFile)) {
      throw new Error(`NDJSON file does not exist: ${ndjsonFile}`);
    }

    // Environment configuration using shared validation
    const env = validateEnv(process.env);
    const couchConfig = getCouchDbConfig(env);

    const dbName = database || couchConfig.dbName;

    console.log(`Starting NDJSON restore to database: ${dbName}`);
    console.log(`Source file: ${ndjsonFile}`);

    // Get file size
    const fileStats = fs.statSync(ndjsonFile);
    console.log(`File size: ${formatFileSize(fileStats.size)}`);

    // Check if database exists and has documents
    const { exists, docCount } = await checkDatabaseExists(dbName, env.COUCHDB_URL);

    if (exists && docCount > 0 && !force) {
      console.error(`Error: Database '${dbName}' already exists and contains ${docCount} documents.`);
      console.error('This restore operation would overwrite existing data.');
      console.error('');
      console.error('To proceed anyway, use the --force parameter:');
      console.error(`  pnpm restore:ndjson ${ndjsonFile} ${database ? `--database ${database}` : ''} --force`.trim());
      process.exit(1);
    }

    if (exists && docCount > 0) {
      console.log(`Warning: Overwriting existing database with ${docCount} documents (--force was used)`);
    }

    // Parse NDJSON file
    const docs = parseNdjsonFile(ndjsonFile);

    // Recreate the database to ensure it's empty
    await recreateDatabase(dbName, env.COUCHDB_URL);

    // Perform bulk insert
    await bulkInsertDocuments(docs, dbName, couchConfig);

    console.log(`NDJSON restore completed successfully!`);

    // Verify the restored database
    const { exists: verifyExists, docCount: verifyDocCount } = await checkDatabaseExists(dbName, env.COUCHDB_URL);
    if (verifyExists) {
      console.log(`Verified: Database '${dbName}' now contains ${verifyDocCount} documents`);
    }

  } catch (error) {
    console.error('NDJSON restore failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let ndjsonFile: string | undefined;
  let database: string | undefined;
  let force: boolean = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--database' || arg === '-d') {
      database = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: restore-ndjson.ts <ndjson-file> [options]

Arguments:
  ndjson-file       Path to NDJSON file (required)

Options:
  -d, --database    Target database name (default: from environment config)
  -f, --force       Force restore even if database exists and has documents
  -h, --help        Show this help message

Examples:
  pnpm restore:ndjson ./all-todos.ndjson
  pnpm restore:ndjson ./backup.ndjson --database my-test-db
  pnpm restore:ndjson ./data.ndjson --database todos-backup --force

NDJSON Format:
  Each line must contain a valid JSON document.
  Example:
    {"_id":"doc1","title":"Task 1","completed":false}
    {"_id":"doc2","title":"Task 2","completed":true}
      `);
      process.exit(0);
    } else if (!ndjsonFile && !arg.startsWith('-')) {
      ndjsonFile = arg;
    }
  }

  return { ndjsonFile, database, force };
}

// Run restore if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ndjsonFile, database, force } = parseArgs();

  if (!ndjsonFile) {
    console.error('Error: NDJSON file argument is required');
    console.error('');
    console.error('Usage: pnpm restore:ndjson <ndjson-file> [options]');
    console.error('Use --help for more information');
    process.exit(1);
  }

  restoreNdjson(ndjsonFile, database, force).catch(console.error);
}

export { restoreNdjson };