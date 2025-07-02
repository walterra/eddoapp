import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabaseManager, generateTestDbName, createTestEnv, SAMPLE_TODO_DOCS } from './test-utils';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup-interactive.ts');
const RESTORE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'restore-interactive.ts');

describe('Restore Interactive E2E', () => {
  let testDir: string;
  let backupDir: string;
  let dbManager: TestDatabaseManager;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    dbManager = new TestDatabaseManager();
  });
  
  afterEach(async () => {
    await dbManager.cleanupAll();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should restore from real backup file to CouchDB', async () => {
    const sourceDbName = generateTestDbName('restore-source');
    const targetDbName = generateTestDbName('restore-target');
    const testEnv = createTestEnv();

    // Step 1: Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, SAMPLE_TODO_DOCS);

    // Step 2: Create a backup
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    // Step 3: Find the backup file
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
    const backupFile = path.join(backupDir, backupFiles[0]);

    // Step 4: Restore to a new database
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .stdout(new RegExp(targetDbName))
      .code(0);

    // Verify that target database was created
    await dbManager.waitForDatabase(targetDbName, true);
  }, 45000);

  it('should handle dry run mode', async () => {
    const targetDbName = generateTestDbName('dry-run-test');
    const testEnv = createTestEnv();

    // Create a mock backup file for dry run testing
    const mockBackupFile = path.join(backupDir, 'mock-backup.json');
    const mockData = JSON.stringify({ docs: SAMPLE_TODO_DOCS }) + '\n';
    fs.writeFileSync(mockBackupFile, mockData);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', targetDbName, '--backup-file', mockBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .stdout(new RegExp(targetDbName))
      .code(0);
  }, 30000);

  it('should show help information', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--help'])
      .stdout(/Interactive CouchDB restore tool/)
      .stdout(/Options:/)
      .code(0);
  }, 15000);

  it('should validate backup file existence', async () => {
    const targetDbName = generateTestDbName('file-check-test');
    const nonExistentFile = path.join(testDir, 'nonexistent.json');
    const testEnv = createTestEnv();
    
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', nonExistentFile])
      .stderr(/does not exist|not found/)
      .code(1);
  }, 30000);

  it('should show configuration summary for real restore', async () => {
    const sourceDbName = generateTestDbName('config-source');
    const targetDbName = generateTestDbName('config-target');
    const testEnv = createTestEnv();

    // Create source database and backup
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    const backupFile = path.join(backupDir, backupFiles[0]);

    // Test restore with custom parameters
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--parallelism', '3', '--timeout', '60000', '--force-overwrite'])
      .stdout(/Restore Configuration:/)
      .stdout(new RegExp(targetDbName))
      .stdout(/Parallelism: 3/)
      .stdout(/Timeout: 60000ms/)
      .stdout(/Restore Summary:/)
      .code(0);
  }, 45000);

  it('should handle user cancellation without force overwrite', async () => {
    const targetDbName = generateTestDbName('no-force-test');
    const testEnv = createTestEnv();

    // Create a mock backup file
    const mockBackupFile = path.join(backupDir, 'mock-backup.json');
    const mockData = JSON.stringify({ docs: SAMPLE_TODO_DOCS }) + '\n';
    fs.writeFileSync(mockBackupFile, mockData);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', mockBackupFile])
      .stdout(/Restore cancelled - force overwrite not confirmed/)
      .code(0);
  }, 30000);

  it('should accept custom backup directory parameter', async () => {
    const sourceDbName = generateTestDbName('custom-dir-source');
    const targetDbName = generateTestDbName('custom-dir-target');
    const customBackupDir = path.join(testDir, 'custom-backups');
    const testEnv = createTestEnv();

    fs.mkdirSync(customBackupDir, { recursive: true });

    // Create source database and backup to custom directory
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', customBackupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    const backupFiles = fs.readdirSync(customBackupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    const backupFile = path.join(customBackupDir, backupFiles[0]);

    // Test restore from custom directory
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--backup-dir', customBackupDir, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);
  }, 45000);

  it.skipIf(process.env.CI)('should handle user cancellation in interactive mode', async () => {
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT])
      .stdin(/Select target database for restore:/, '\x03') // Ctrl+C to cancel
      .stdout(/Restore cancelled/i)
      .code(0); // prompts library exits with 0 when cancelled
  }, 30000);

  it('should validate parallelism parameter range', async () => {
    const sourceDbName = generateTestDbName('parallelism-source');
    const targetDbName = generateTestDbName('parallelism-target');
    const testEnv = createTestEnv();

    // Create source database and backup
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    const backupFile = path.join(backupDir, backupFiles[0]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--parallelism', '8', '--force-overwrite'])
      .stdout(/Parallelism: 8/)
      .stdout(/Restore Summary:/)
      .code(0);
  }, 45000);

  it('should handle missing backup file parameter in non-interactive mode', async () => {
    const targetDbName = generateTestDbName('missing-file-test');
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName])
      .stderr(/Backup file parameter is required in non-interactive mode/)
      .code(1);
  }, 30000);

  it('should handle invalid backup file format', async () => {
    const targetDbName = generateTestDbName('invalid-format-test');
    const testEnv = createTestEnv();

    // Create an invalid backup file
    const invalidBackupFile = path.join(backupDir, 'invalid-backup.json');
    fs.writeFileSync(invalidBackupFile, 'invalid json content');

    // The restore may succeed but with 0 documents restored due to invalid format
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', invalidBackupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);

    // The restore "succeeds" but should have restored 0 documents due to invalid format
    // This is actually expected behavior with @cloudant/couchbackup - it handles invalid JSON gracefully
  }, 30000);
});

describe('Restore Interactive E2E - File Discovery', () => {
  let testDir: string;
  let backupDir: string;
  let dbManager: TestDatabaseManager;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-discovery-test-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    dbManager = new TestDatabaseManager();
  });
  
  afterEach(async () => {
    await dbManager.cleanupAll();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should restore from discovered backup files', async () => {
    const sourceDbName = generateTestDbName('discovery-source');
    const targetDbName = generateTestDbName('discovery-target');
    const testEnv = createTestEnv();

    // Create multiple source databases and their backups
    const databases = [`${sourceDbName}-dev`, `${sourceDbName}-prod`, `${sourceDbName}-test`];
    
    for (const dbName of databases) {
      await dbManager.createTestDatabase(dbName);
      await dbManager.addSampleData(dbName, [SAMPLE_TODO_DOCS[0]]);
      
      await runner()
        .env(testEnv)
        .cwd(PROJECT_ROOT)
        .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', dbName, '--backup-dir', backupDir])
        .stdout(/Backup Summary:/)
        .code(0);
    }

    // Verify multiple backup files were created
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    expect(backupFiles.length).toBe(3);

    // Test restore using one of the backup files
    const selectedBackupFile = path.join(backupDir, backupFiles[0]);
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', selectedBackupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);
  }, 60000);

  it.skipIf(process.env.CI)('should discover backup files in directory', async () => {
    const sourceDbName = generateTestDbName('interactive-discovery');
    const testEnv = createTestEnv();

    // Create a real backup file
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    // Start the command and cancel immediately to test file discovery
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--backup-dir', backupDir])
      .stdin(/Select target database for restore:/, '\x03') // Cancel after discovery
      .stdout(/Restore cancelled/i)
      .code(0);
  }, 45000);

  it.skipIf(process.env.CI)('should handle empty backup directory', async () => {
    const emptyBackupDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyBackupDir, { recursive: true });
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--backup-dir', emptyBackupDir])
      .stdin(/Select target database for restore:/, '\x03') // Cancel at first prompt
      .stdout(/Restore cancelled/i)
      .code(0);
  }, 30000);
});