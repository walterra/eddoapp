#!/usr/bin/env tsx

/**
 * NDJSON restore script for CouchDB
 * Restores CouchDB database from a NDJSON (Newline Delimited JSON) backup file
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import { checkDatabaseExists, formatFileSize, recreateDatabase } from './backup-utils.js';
import {
  bulkInsertDocuments,
  logOverwriteWarning,
  parseNdjsonFile,
  printExistingDatabaseError,
} from './restore-ndjson-helpers.js';

dotenvLoad();

/** Options for database check */
interface DatabaseCheckOptions {
  dbName: string;
  couchUrl: string;
  ndjsonFile: string;
  database?: string;
  force: boolean;
  append: boolean;
}

/** Result of database check */
interface DatabaseCheckResult {
  shouldProceed: boolean;
  exists: boolean;
  docCount: number;
}

/**
 * Handle append mode database check
 */
function handleAppendMode(exists: boolean, docCount: number): DatabaseCheckResult {
  if (exists) {
    console.log(`Appending to existing database with ${docCount} documents`);
  } else {
    console.log(`Database doesn't exist, creating new database for append operation`);
  }
  return { shouldProceed: true, exists, docCount };
}

/**
 * Handle restore mode database check
 */
function handleRestoreMode(
  opts: DatabaseCheckOptions,
  exists: boolean,
  docCount: number,
): DatabaseCheckResult {
  if (exists && docCount > 0 && !opts.force) {
    printExistingDatabaseError(opts.dbName, docCount, opts.ndjsonFile, opts.database);
    return { shouldProceed: false, exists, docCount };
  }

  if (exists && docCount > 0) {
    logOverwriteWarning('restore', docCount);
  }

  return { shouldProceed: true, exists, docCount };
}

/**
 * Handle database existence check and determine if restore should proceed
 */
async function handleDatabaseCheck(opts: DatabaseCheckOptions): Promise<DatabaseCheckResult> {
  const { exists, docCount } = await checkDatabaseExists(opts.dbName, opts.couchUrl);

  if (opts.append) {
    return handleAppendMode(exists, docCount);
  }

  return handleRestoreMode(opts, exists, docCount);
}

/**
 * Main restore function
 */
async function restoreNdjson(
  ndjsonFile: string,
  database?: string,
  force: boolean = false,
  append: boolean = false,
): Promise<void> {
  try {
    if (!fs.existsSync(ndjsonFile)) {
      throw new Error(`NDJSON file does not exist: ${ndjsonFile}`);
    }

    const env = validateEnv(process.env);
    const couchConfig = getCouchDbConfig(env);
    const dbName = database || couchConfig.dbName;
    const operation = append ? 'append' : 'restore';

    console.log(`Starting NDJSON ${operation} to database: ${dbName}`);
    console.log(`Source file: ${ndjsonFile}`);
    console.log(`File size: ${formatFileSize(fs.statSync(ndjsonFile).size)}`);

    const checkResult = await handleDatabaseCheck({
      dbName,
      couchUrl: env.COUCHDB_URL,
      ndjsonFile,
      database,
      force,
      append,
    });

    if (!checkResult.shouldProceed) {
      process.exit(1);
    }

    const docs = parseNdjsonFile(ndjsonFile);

    if (!append || !checkResult.exists) {
      await recreateDatabase(dbName, env.COUCHDB_URL);
    }

    await bulkInsertDocuments(docs, dbName, couchConfig);

    console.log(`NDJSON ${operation} completed successfully!`);

    const { exists, docCount } = await checkDatabaseExists(dbName, env.COUCHDB_URL);
    if (exists) {
      console.log(`Verified: Database '${dbName}' now contains ${docCount} documents`);
    }
  } catch (error) {
    console.error('NDJSON restore failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  ndjsonFile?: string;
  database?: string;
  force: boolean;
  append: boolean;
} {
  const args = process.argv.slice(2);
  let ndjsonFile: string | undefined;
  let database: string | undefined;
  let force = false;
  let append = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--database' || arg === '-d') {
      database = args[++i];
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--append' || arg === '-a') {
      append = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!ndjsonFile && !arg.startsWith('-')) {
      ndjsonFile = arg;
    }
  }

  return { ndjsonFile, database, force, append };
}

function printHelp(): void {
  console.log(`
Usage: restore-ndjson.ts <ndjson-file> [options]

Arguments:
  ndjson-file       Path to NDJSON file (required)

Options:
  -d, --database    Target database name (default: from environment config)
  -f, --force       Force restore even if database exists and has documents
  -a, --append      Append documents to existing database instead of replacing
  -h, --help        Show this help message

Examples:
  pnpm restore:ndjson ./all-todos.ndjson
  pnpm restore:ndjson ./backup.ndjson --database my-test-db
  pnpm restore:ndjson ./data.ndjson --database todos-backup --force
  pnpm restore:ndjson ./new-todos.ndjson --database todos-dev --append

NDJSON Format:
  Each line must contain a valid JSON document.
  Example:
    {"_id":"doc1","title":"Task 1","completed":false}
    {"_id":"doc2","title":"Task 2","completed":true}

Notes:
  --append mode will fail if documents with same _id already exist in database.
  Use restore mode (default) to replace the entire database contents.
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ndjsonFile, database, force, append } = parseArgs();

  if (!ndjsonFile) {
    console.error('Error: NDJSON file argument is required');
    console.error('');
    console.error('Usage: pnpm restore:ndjson <ndjson-file> [options]');
    console.error('Use --help for more information');
    process.exit(1);
  }

  restoreNdjson(ndjsonFile, database, force, append).catch(console.error);
}

export { restoreNdjson };
