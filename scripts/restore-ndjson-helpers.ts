/**
 * Helper functions for NDJSON restore operations
 */

import { getCouchDbConfig } from '@eddo/core-server/config';
import fs from 'fs';

/** Bulk docs request structure for CouchDB */
export interface BulkDocsRequest {
  docs: unknown[];
}

/** Response from CouchDB bulk docs operation */
export interface BulkDocsResponse {
  id: string;
  rev?: string;
  error?: string;
  reason?: string;
}

/**
 * Parse NDJSON file and return array of documents
 */
export function parseNdjsonFile(filePath: string): unknown[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`NDJSON file does not exist: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error(`NDJSON file is empty: ${filePath}`);
  }

  console.log(`Found ${lines.length} lines in NDJSON file`);

  const docs: unknown[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    try {
      const doc = JSON.parse(line);
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
    errors.slice(0, 5).forEach((err) => console.error(`  ${err}`));
    if (errors.length > 5) {
      console.error(`  ... and ${errors.length - 5} more errors`);
    }
    throw new Error(`NDJSON file contains malformed JSON lines`);
  }

  console.log(`Successfully parsed ${docs.length} documents from NDJSON`);
  return docs;
}

/**
 * Extract credentials and create proper headers for CouchDB requests
 */
export function getAuthHeaders(
  couchConfig: ReturnType<typeof getCouchDbConfig>,
): Record<string, string> {
  const url = new URL(couchConfig.url);
  if (url.username && url.password) {
    const auth = Buffer.from(`${url.username}:${url.password}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Get clean URL without credentials
 */
export function getCleanUrl(
  dbName: string,
  couchConfig: ReturnType<typeof getCouchDbConfig>,
): string {
  const url = new URL(couchConfig.url);
  url.username = '';
  url.password = '';
  return `${url.origin}/${dbName}`;
}

/**
 * Log bulk insert errors
 */
function logBulkErrors(errors: BulkDocsResponse[]): void {
  console.error(`${errors.length} documents failed to insert:`);
  errors.slice(0, 5).forEach((err) => {
    console.error(`  ID: ${err.id}, Error: ${err.error}, Reason: ${err.reason}`);
  });
  if (errors.length > 5) {
    console.error(`  ... and ${errors.length - 5} more errors`);
  }
}

/**
 * Perform bulk insert of documents using CouchDB _bulk_docs endpoint
 */
export async function bulkInsertDocuments(
  docs: unknown[],
  dbName: string,
  couchConfig: ReturnType<typeof getCouchDbConfig>,
): Promise<void> {
  const bulkDoc: BulkDocsRequest = { docs };
  const cleanUrl = getCleanUrl(dbName, couchConfig);
  const headers = getAuthHeaders(couchConfig);

  console.log(`Inserting ${docs.length} documents using CouchDB _bulk_docs endpoint...`);

  const response = await fetch(`${cleanUrl}/_bulk_docs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bulkDoc),
  });

  if (!response.ok) {
    throw new Error(`Bulk insert failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as BulkDocsResponse[];
  const errors = result.filter((doc) => doc.error);
  const successes = result.filter((doc) => !doc.error);

  if (errors.length > 0) {
    logBulkErrors(errors);
  }

  console.log(`Successfully inserted ${successes.length} documents`);

  if (errors.length > 0) {
    throw new Error(`${errors.length} documents failed to insert`);
  }
}

/**
 * Log database overwrite warning when force is used
 */
export function logOverwriteWarning(operation: string, docCount: number): void {
  console.log(
    `Warning: Overwriting existing database with ${docCount} documents (--force was used)`,
  );
}

/**
 * Print error message and instructions when database exists with data
 */
export function printExistingDatabaseError(
  dbName: string,
  docCount: number,
  ndjsonFile: string,
  database?: string,
): void {
  console.error(`Error: Database '${dbName}' already exists and contains ${docCount} documents.`);
  console.error('This restore operation would overwrite existing data.');
  console.error('');
  console.error('To proceed anyway, use the --force parameter:');
  console.error(
    `  pnpm restore:ndjson ${ndjsonFile} ${database ? `--database ${database}` : ''} --force`.trim(),
  );
  console.error('Or use --append to add documents to the existing database:');
  console.error(
    `  pnpm restore:ndjson ${ndjsonFile} ${database ? `--database ${database}` : ''} --append`.trim(),
  );
}
