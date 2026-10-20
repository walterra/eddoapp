#!/usr/bin/env tsx
/** Verifies archive structure, attachments, checksums, and source inventories. */
import fs from 'node:fs';
import path from 'node:path';
import { getAllBackupFiles } from './backup-utils.js';
import { readBackupMetadata, validateBackupArchive } from './backup_metadata.js';

export interface ValidationResult {
  totalDocuments: number;
  validDocuments: number;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

/** Validates one archive, including empty databases and legacy files. */
export async function validateBackupFile(file: string): Promise<ValidationResult> {
  let documents = 0;
  let attachments = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const validated = await validateBackupArchive(file);
    documents = validated.documents;
    attachments = validated.attachments;
    if (!readBackupMetadata(file))
      warnings.push('Legacy archive: security settings and source completeness cannot be verified');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const result: ValidationResult = {
    totalDocuments: documents,
    validDocuments: errors.length ? 0 : documents,
    errors: [...new Set(errors)],
    warnings,
    isValid: errors.length === 0,
  };
  console.log(
    `${result.isValid ? 'PASS' : 'FAIL'} ${path.basename(file)}: ${documents} records, ${attachments} attachments`,
  );
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  for (const error of result.errors) console.error(`Error: ${error}`);
  return result;
}

/** Verifies one archive or every published archive in the configured directory. */
export async function verifyBackup(file?: string): Promise<boolean> {
  if (file) return (await validateBackupFile(file)).isValid;
  const directory = process.env.BACKUP_DIR || './backups';
  const files = getAllBackupFiles(directory);
  if (!files.length) throw new Error(`No published backup files found in ${directory}`);
  let valid = true;
  for (const backup of files) {
    if (!(await validateBackupFile(backup.path)).isValid) valid = false;
  }
  return valid;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (file && !fs.existsSync(file)) {
    console.error('Backup file does not exist');
    process.exitCode = 1;
  } else {
    verifyBackup(file)
      .then((valid) => {
        if (!valid) process.exitCode = 1;
      })
      .catch(() => {
        console.error('Backup verification failed');
        process.exitCode = 1;
      });
  }
}
