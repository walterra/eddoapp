#!/usr/bin/env tsx

/**
 * Backup verification script
 * Validates backup files and checks data integrity
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { TodoAlpha3 } from '@eddo/core/types/todo';

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface ValidationResult {
  totalDocuments: number;
  validDocuments: number;
  errors: string[];
  isValid: boolean;
}

interface BackupDocument {
  _id?: string;
  version?: string;
  [key: string]: unknown;
}

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
      crlfDelay: Infinity
    });
    
    let documentCount = 0;
    let validDocuments = 0;
    const errors: string[] = [];
    
    rl.on('line', (line: string) => {
      documentCount++;
      
      try {
        const doc = JSON.parse(line) as BackupDocument;
        
        // Basic validation
        if (!doc._id) {
          errors.push(`Line ${documentCount}: Missing _id field`);
        } else if (doc.version && !['alpha1', 'alpha2', 'alpha3'].includes(doc.version)) {
          errors.push(`Line ${documentCount}: Invalid version field: ${doc.version}`);
        } else {
          validDocuments++;
          
          // Additional validation for TodoAlpha3 documents
          if (doc.version === 'alpha3') {
            const todo = doc as Partial<TodoAlpha3>;
            if (!todo.title) {
              errors.push(`Line ${documentCount}: TodoAlpha3 missing title field`);
            }
            if (!todo.context) {
              errors.push(`Line ${documentCount}: TodoAlpha3 missing context field`);
            }
            if (!todo.due) {
              errors.push(`Line ${documentCount}: TodoAlpha3 missing due field`);
            }
          }
        }
        
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        errors.push(`Line ${documentCount}: Invalid JSON - ${errorMessage}`);
      }
    });
    
    rl.on('close', () => {
      const result: ValidationResult = {
        totalDocuments: documentCount,
        validDocuments,
        errors,
        isValid: errors.length === 0 && documentCount > 0
      };
      
      console.log(`Total documents: ${result.totalDocuments}`);
      console.log(`Valid documents: ${result.validDocuments}`);
      console.log(`Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.log('Validation errors:');
        result.errors.forEach((error) => console.log(`  - ${error}`));
      }
      
      resolve(result);
    });
    
    rl.on('error', (error: Error) => {
      reject(error);
    });
  });
}

async function verifyBackup(backupFile?: string): Promise<boolean> {
  try {
    if (backupFile) {
      // Verify specific file
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
    } else {
      // Verify all backup files in directory
      if (!fs.existsSync(BACKUP_DIR)) {
        throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
      }
      
      const backupFiles = fs.readdirSync(BACKUP_DIR)
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
        return true;
      } else {
        console.log('\n❌ Some backup files have validation errors');
        return false;
      }
    }
    
  } catch (error) {
    console.error('Backup verification failed:', error instanceof Error ? error.message : String(error));
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

export { verifyBackup };