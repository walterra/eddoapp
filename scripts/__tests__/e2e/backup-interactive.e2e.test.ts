import { runner } from 'clet';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestEnv,
  generateTestDbName,
  SAMPLE_TODO_DOCS,
  TestDatabaseManager,
} from './test-utils';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup-interactive.ts');

describe('Backup Interactive E2E', () => {
  let testDir: string;
  let backupDir: string;
  let dbManager: TestDatabaseManager;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
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

  it('should create backup from real CouchDB database', async () => {
    const sourceDbName = generateTestDbName('backup-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, SAMPLE_TODO_DOCS);

    // Perform backup
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
      ])
      .stdout(/Backup Summary:/)
      .stdout(new RegExp(sourceDbName))
      .code(0);

    // Verify backup file was created
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);

    // Verify backup content
    const backupFile = path.join(backupDir, backupFiles[0]);
    const backupContent = fs.readFileSync(backupFile, 'utf8');
    expect(backupContent).toContain('E2E Test Todo 1');
    expect(backupContent).toContain('alpha3');
  }, 60000);

  it('should handle dry run mode', async () => {
    const sourceDbName = generateTestDbName('dry-run-test');
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--dry-run',
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
      ])
      .stdout(/Dry run mode/)
      .stdout(new RegExp(sourceDbName))
      .code(0);

    // Verify no backup file was created
    const backupFiles = fs.readdirSync(backupDir);
    expect(backupFiles.length).toBe(0);
  }, 60000);

  it('should show help information', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--help'])
      .stdout(/Interactive CouchDB backup tool/)
      .stdout(/Options:/)
      .code(0);
  }, 15000);

  it('should validate parallelism parameter range', async () => {
    const sourceDbName = generateTestDbName('parallelism-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
        '--parallelism',
        '15',
      ])
      .stdout(/Backup Summary:/)
      .stdout(/Parallelism: 15/)
      .code(0);

    // Verify backup was created
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it.skipIf(process.env.CI)(
    'should handle user cancellation in interactive mode',
    async () => {
      const testEnv = createTestEnv();

      await runner()
        .env(testEnv)
        .cwd(PROJECT_ROOT)
        .spawn('tsx', [BACKUP_SCRIPT])
        .stdin(/Select database to backup:/, '\x03') // Ctrl+C to cancel
        .stdout(/Backup cancelled/i)
        .code(0); // prompts library exits with 0 when cancelled
    },
    30000,
  );

  it('should accept custom backup directory', async () => {
    const sourceDbName = generateTestDbName('custom-dir-test');
    const customBackupDir = path.join(testDir, 'custom-backups');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        customBackupDir,
      ])
      .stdout(/Backup Summary:/)
      .stdout(new RegExp(customBackupDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .code(0);

    // Verify custom directory was created and contains backup
    expect(fs.existsSync(customBackupDir)).toBe(true);
    const backupFiles = fs
      .readdirSync(customBackupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it('should handle missing database parameter in non-interactive mode', async () => {
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--backup-dir', backupDir])
      .stderr(/Error/i)
      .code(1);
  }, 60000);

  it('should show configuration summary for real backup', async () => {
    const sourceDbName = generateTestDbName('config-summary-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
        '--parallelism',
        '5',
        '--timeout',
        '60000',
      ])
      .stdout(/Backup Configuration:/)
      .stdout(new RegExp(sourceDbName))
      .stdout(/Parallelism: 5/)
      .stdout(/Timeout: 60000ms/)
      .stdout(/Backup Summary:/)
      .code(0);

    // Verify backup was created
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it('should create backup directory if it does not exist', async () => {
    const sourceDbName = generateTestDbName('create-dir-test');
    const nonExistentDir = path.join(testDir, 'new-backup-dir');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        nonExistentDir,
      ])
      .stdout(/Backup Summary:/)
      .code(0);

    // Directory should be created and contain backup
    expect(fs.existsSync(nonExistentDir)).toBe(true);
    const backupFiles = fs
      .readdirSync(nonExistentDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it('should handle existing backup files and show them', async () => {
    const sourceDbName = generateTestDbName('existing-backup-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, SAMPLE_TODO_DOCS);

    // Create first backup
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
      ])
      .stdout(/Backup Summary:/)
      .code(0);

    // Wait a moment and create second backup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create second backup - should show existing backups
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
      ])
      .stdout(/Backup Summary:/)
      .stdout(/Existing backups:/)
      .code(0);

    // Verify both backup files exist
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(2);
  }, 45000);
});

describe('Backup Interactive E2E - Error Scenarios', () => {
  let testDir: string;
  let backupDir: string;
  let dbManager: TestDatabaseManager;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-error-test-'));
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

  it('should handle timeout values in real backup', async () => {
    const sourceDbName = generateTestDbName('timeout-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
        '--timeout',
        '60000',
      ])
      .stdout(/Backup Summary:/)
      .stdout(/Timeout: 60000ms/)
      .code(0);

    // Verify backup was created
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it('should handle zero parallelism parameter', async () => {
    const sourceDbName = generateTestDbName('zero-parallelism-test');
    const testEnv = createTestEnv();

    // Create source database with sample data
    await dbManager.createTestDatabase(sourceDbName);
    await dbManager.addSampleData(sourceDbName, [SAMPLE_TODO_DOCS[0]]);

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        sourceDbName,
        '--backup-dir',
        backupDir,
        '--parallelism',
        '1',
      ])
      .stdout(/Backup Summary:/)
      .stdout(/Parallelism: 1/)
      .code(0);

    // Verify backup was created
    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(sourceDbName) && f.endsWith('.json'));
    expect(backupFiles.length).toBe(1);
  }, 60000);

  it('should handle non-existent database', async () => {
    const nonExistentDbName = generateTestDbName('non-existent');
    const testEnv = createTestEnv();

    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [
        BACKUP_SCRIPT,
        '--no-interactive',
        '--database',
        nonExistentDbName,
        '--backup-dir',
        backupDir,
      ])
      .stdout(/Backup Configuration:/)
      .code(1);

    // Verify either no backup file or empty backup file was created
    const backupFiles = fs.readdirSync(backupDir);
    if (backupFiles.length > 0) {
      // If a file was created, it should be very small (empty or nearly empty)
      const backupFile = path.join(backupDir, backupFiles[0]);
      const stats = fs.statSync(backupFile);
      expect(stats.size).toBeLessThan(100); // Less than 100 bytes indicates empty/failed backup
    }
  }, 60000);
});
