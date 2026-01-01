#!/usr/bin/env tsx

/**
 * Backup verification script
 * Validates backup files created by @cloudant/couchbackup
 *
 * Couchbackup format:
 * - Line 1: Header with metadata {"name":"@cloudant/couchbackup","version":"...","mode":"...","attachments":...}
 * - Line 2+: JSON arrays containing batched documents [{doc1}, {doc2}, ...]
 */

import type { TodoAlpha3 } from '@eddo/core-server/types/todo';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface ValidationResult {
  totalDocuments: number;
  validDocuments: number;
  designDocuments: number;
  todoDocuments: number;
  errors: string[];
  warnings: string[];
  isValid: boolean;
  backupVersion?: string;
  backupMode?: string;
}

interface BackupHeader {
  name: string;
  version: string;
  mode: string;
  attachments: boolean;
}

interface BackupDocument {
  _id?: string;
  _rev?: string;
  version?: string;
  [key: string]: unknown;
}

interface DocumentValidation {
  valid: boolean;
  error?: string;
  warning?: string;
  isDesign: boolean;
  isTodo: boolean;
}

interface ValidationCounters {
  totalDocuments: number;
  validDocuments: number;
  designDocuments: number;
  todoDocuments: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validate TodoAlpha3 fields
 */
function validateTodoAlpha3(
  doc: Partial<TodoAlpha3>,
  lineNumber: number,
  docIndex: number,
): string | null {
  const missingFields: string[] = [];

  if (!doc.title) missingFields.push('title');
  if (!doc.context) missingFields.push('context');
  if (!doc.due) missingFields.push('due');

  if (missingFields.length > 0) {
    return `Line ${lineNumber}, doc ${docIndex} (${doc._id}): TodoAlpha3 missing fields: ${missingFields.join(', ')}`;
  }

  return null;
}

/**
 * Validate a single document from the backup
 */
function validateDocument(
  doc: BackupDocument,
  lineNumber: number,
  docIndex: number,
): DocumentValidation {
  // Check for required _id field
  if (!doc._id) {
    return {
      valid: false,
      error: `Line ${lineNumber}, doc ${docIndex}: Missing _id field`,
      isDesign: false,
      isTodo: false,
    };
  }

  // Design documents start with _design/
  const isDesign = doc._id.startsWith('_design/');

  // Todo documents have a version field
  const isTodo =
    typeof doc.version === 'string' && ['alpha1', 'alpha2', 'alpha3'].includes(doc.version);

  // Validate TodoAlpha3 documents
  if (doc.version === 'alpha3') {
    const warning = validateTodoAlpha3(doc as Partial<TodoAlpha3>, lineNumber, docIndex);
    if (warning) {
      return { valid: true, warning, isDesign, isTodo };
    }
  }

  return { valid: true, isDesign, isTodo };
}

/**
 * Parse and validate couchbackup header
 */
function parseHeader(line: string): BackupHeader | null {
  try {
    const header = JSON.parse(line) as BackupHeader;
    if (header.name === '@cloudant/couchbackup' && header.version && header.mode) {
      return header;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse document batch (JSON array of documents)
 */
function parseDocumentBatch(line: string): BackupDocument[] | null {
  try {
    const parsed = JSON.parse(line);
    if (Array.isArray(parsed)) {
      return parsed as BackupDocument[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Process a batch of documents and update counters
 */
function processBatch(
  batch: BackupDocument[],
  lineNumber: number,
  counters: ValidationCounters,
): void {
  for (let i = 0; i < batch.length; i++) {
    counters.totalDocuments++;
    const result = validateDocument(batch[i], lineNumber, i + 1);

    if (result.valid) {
      counters.validDocuments++;
      if (result.isDesign) counters.designDocuments++;
      if (result.isTodo) counters.todoDocuments++;
    }

    if (result.error) counters.errors.push(result.error);
    if (result.warning) counters.warnings.push(result.warning);
  }
}

/**
 * Process a single document (NDJSON format fallback)
 */
function processSingleDocument(
  line: string,
  lineNumber: number,
  counters: ValidationCounters,
): void {
  try {
    const doc = JSON.parse(line) as BackupDocument;
    counters.totalDocuments++;
    const result = validateDocument(doc, lineNumber, 1);

    if (result.valid) {
      counters.validDocuments++;
      if (result.isDesign) counters.designDocuments++;
      if (result.isTodo) counters.todoDocuments++;
    }

    if (result.error) counters.errors.push(result.error);
    if (result.warning) counters.warnings.push(result.warning);
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
    counters.errors.push(`Line ${lineNumber}: Invalid JSON - ${errorMessage}`);
  }
}

interface LineProcessingContext {
  lineNumber: number;
  counters: ValidationCounters;
  backupVersion?: string;
  backupMode?: string;
}

/**
 * Process a line from the backup file
 */
function processLine(line: string, context: LineProcessingContext): void {
  context.lineNumber++;

  // Skip empty lines
  if (line.trim() === '') {
    return;
  }

  // First line should be the couchbackup header
  if (context.lineNumber === 1) {
    const header = parseHeader(line);
    if (header) {
      context.backupVersion = header.version;
      context.backupMode = header.mode;
      console.log(`Backup format: couchbackup v${header.version} (mode: ${header.mode})`);
      return;
    }
    // If not a header, treat as document batch (legacy format or different tool)
  }

  // Parse document batch
  const batch = parseDocumentBatch(line);
  if (batch) {
    processBatch(batch, context.lineNumber, context.counters);
  } else {
    // Try parsing as single document (NDJSON format fallback)
    processSingleDocument(line, context.lineNumber, context.counters);
  }
}

/**
 * Log validation result summary
 */
function logValidationSummary(result: ValidationResult): void {
  console.log(`Total documents: ${result.totalDocuments}`);
  console.log(`  Valid: ${result.validDocuments}`);
  console.log(`  Design docs: ${result.designDocuments}`);
  console.log(`  Todo docs: ${result.todoDocuments}`);

  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    result.errors.slice(0, 10).forEach((error) => console.log(`  - ${error}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings: ${result.warnings.length}`);
    result.warnings.slice(0, 5).forEach((warning) => console.log(`  - ${warning}`));
    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more warnings`);
    }
  }
}

/**
 * Validate a backup file
 */
function validateBackupFile(filePath: string): Promise<ValidationResult> {
  console.log(`Validating backup file: ${filePath}`);

  const stats = fs.statSync(filePath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  if (stats.size === 0) {
    throw new Error('Backup file is empty');
  }

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const context: LineProcessingContext = {
      lineNumber: 0,
      counters: {
        totalDocuments: 0,
        validDocuments: 0,
        designDocuments: 0,
        todoDocuments: 0,
        errors: [],
        warnings: [],
      },
    };

    rl.on('line', (line: string) => processLine(line, context));

    rl.on('close', () => {
      const result: ValidationResult = {
        ...context.counters,
        isValid: context.counters.errors.length === 0 && context.counters.totalDocuments > 0,
        backupVersion: context.backupVersion,
        backupMode: context.backupMode,
      };

      logValidationSummary(result);
      resolve(result);
    });

    rl.on('error', (error: Error) => reject(error));
  });
}

/**
 * Verify a single backup file
 */
async function verifySingleFile(backupFile: string): Promise<boolean> {
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file does not exist: ${backupFile}`);
  }

  const result = await validateBackupFile(backupFile);

  if (result.isValid) {
    console.log('✅ Backup file is valid');
    return true;
  } else {
    console.log('❌ Backup file validation failed');
    return false;
  }
}

/**
 * Verify all backup files in directory
 */
async function verifyAllFiles(): Promise<boolean> {
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
  }

  const backupFiles = fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(BACKUP_DIR, file));

  if (backupFiles.length === 0) {
    throw new Error('No backup files found');
  }

  let allValid = true;

  for (const file of backupFiles) {
    console.log(`\n--- Verifying ${path.basename(file)} ---`);
    const result = await validateBackupFile(file);
    if (!result.isValid) {
      allValid = false;
    }
  }

  if (allValid) {
    console.log('\n✅ All backup files are valid');
  } else {
    console.log('\n❌ Some backup files have validation errors');
  }

  return allValid;
}

/**
 * Verify backup file(s)
 */
async function verifyBackup(backupFile?: string): Promise<boolean> {
  try {
    if (backupFile) {
      return await verifySingleFile(backupFile);
    }
    return await verifyAllFiles();
  } catch (error) {
    console.error(
      'Backup verification failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.length > 0 ? args[0] : undefined;

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyBackup(backupFile).catch(console.error);
}

export { validateBackupFile, verifyBackup };
