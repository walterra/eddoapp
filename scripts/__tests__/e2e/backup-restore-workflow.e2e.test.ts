import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabaseManager, generateTestDbName, createTestEnv, SAMPLE_TODO_DOCS } from './test-utils';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup-interactive.ts');
const RESTORE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'restore-interactive.ts');

describe('Backup-Restore Workflow E2E', () => {
  let testDir: string;
  let backupDir: string;
  let dbManager: TestDatabaseManager;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'));
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

  it('should create backup and then restore from it with real CouchDB', async () => {
    const sourceDbName = generateTestDbName('workflow-source');
    const targetDbName = generateTestDbName('workflow-target');
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
      .stdout(new RegExp(sourceDbName))
      .code(0);

    // Step 3: Find the created backup file
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
    const backupFile = path.join(backupDir, backupFiles[0]);

    // Step 4: Verify backup file content
    expect(fs.existsSync(backupFile)).toBe(true);
    const backupContent = fs.readFileSync(backupFile, 'utf8');
    expect(backupContent).toContain('E2E Test Todo 1');
    expect(backupContent).toContain('E2E Test Todo 2');
    expect(backupContent).toContain('alpha3');

    // Step 5: Restore to a new database
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .stdout(new RegExp(targetDbName))
      .code(0);

    // Verify that target database was created (it will be cleaned up in afterEach)
    await dbManager.waitForDatabase(targetDbName, true);
  }, 60000);

  it('should handle backup with custom parameters and restore with matching settings', async () => {
    const sourceDbName = generateTestDbName('custom-params');
    const targetDbName = generateTestDbName('custom-params-restored');
    const customParallelism = 4;
    const customTimeout = 60000;
    const testEnv = createTestEnv();

    // Step 1: Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    // Step 2: Backup with custom parameters
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir, '--parallelism', customParallelism.toString(), '--timeout', customTimeout.toString()])
      .stdout(/Parallelism: 4/)
      .stdout(/Timeout: 60000ms/)
      .stdout(/Backup Summary:/)
      .code(0);

    // Find backup file
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
    const backupFile = path.join(backupDir, backupFiles[0]);

    // Step 3: Restore with matching custom parameters
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--parallelism', customParallelism.toString(), '--timeout', customTimeout.toString(), '--force-overwrite'])
      .stdout(/Parallelism: 4/)
      .stdout(/Timeout: 60000ms/)
      .stdout(/Restore Summary:/)
      .code(0);
  }, 60000);

  it('should handle invalid backup file format during restore', async () => {
    const targetDbName = generateTestDbName('invalid-backup-test');
    const testEnv = createTestEnv();
    
    // Create an invalid backup file
    const invalidBackupFile = path.join(backupDir, 'invalid-backup.json');
    fs.writeFileSync(invalidBackupFile, 'invalid json content');

    // Try to restore from invalid backup file - @cloudant/couchbackup handles this gracefully
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', invalidBackupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);

    expect(fs.existsSync(invalidBackupFile)).toBe(true);
  }, 30000);

  it('should handle multiple backup files for same database', async () => {
    const sourceDbName = generateTestDbName('multi-backup');
    const targetDbName = generateTestDbName('multi-backup-restored');
    const testEnv = createTestEnv();
    
    // Step 1: Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, SAMPLE_TODO_DOCS);

    // Step 2: Create first backup
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    // Step 3: Wait a moment and create second backup
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Backup Summary:/)
      .stdout(/Existing backups:/)
      .code(0);

    // Step 4: Verify multiple backup files exist
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(2);

    // Step 5: Restore using the latest backup file
    const latestBackupFile = path.join(backupDir, backupFiles.sort().pop()!);
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', latestBackupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);
  }, 75000);

  it('should preserve directory structure and handle subdirectories', async () => {
    const sourceDbName = generateTestDbName('subdir-test');
    const targetDbName = generateTestDbName('subdir-test-restored');
    const subdirBackupDir = path.join(backupDir, 'subdir');
    const testEnv = createTestEnv();
    
    fs.mkdirSync(subdirBackupDir, { recursive: true });

    // Step 1: Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    // Step 2: Backup to subdirectory
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--database', sourceDbName, '--backup-dir', subdirBackupDir])
      .stdout(/Backup Summary:/)
      .code(0);

    expect(fs.existsSync(subdirBackupDir)).toBe(true);
    
    // Step 3: Find backup file in subdirectory
    const backupFiles = fs.readdirSync(subdirBackupDir).filter(f => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
    const backupFile = path.join(subdirBackupDir, backupFiles[0]);

    // Step 4: Restore from subdirectory
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', targetDbName, '--backup-file', backupFile, '--force-overwrite'])
      .stdout(/Restore Summary:/)
      .code(0);
  }, 60000);
  
  it('should test dry-run functionality', async () => {
    const sourceDbName = generateTestDbName('dry-run-test');
    const targetDbName = generateTestDbName('dry-run-test-restored');
    const testEnv = createTestEnv();

    // Test backup dry-run (should not create actual backup file)
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', sourceDbName, '--backup-dir', backupDir])
      .stdout(/Dry run mode/)
      .stdout(new RegExp(sourceDbName))
      .code(0);

    // Verify no backup file was created
    const backupFiles = fs.readdirSync(backupDir);
    expect(backupFiles.length).toBe(0);

    // Create a mock backup file for restore dry-run test
    const mockBackupFile = path.join(backupDir, `${sourceDbName}-mock.json`);
    const mockData = JSON.stringify({ docs: SAMPLE_TODO_DOCS }) + '\n';
    fs.writeFileSync(mockBackupFile, mockData);

    // Test restore dry-run (should not create actual database)
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', targetDbName, '--backup-file', mockBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .stdout(new RegExp(targetDbName))
      .code(0);
  }, 30000);
});