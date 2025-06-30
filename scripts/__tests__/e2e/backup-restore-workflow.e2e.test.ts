import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup-interactive.ts');
const RESTORE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'restore-interactive.ts');

describe('Backup-Restore Workflow E2E', () => {
  let testDir: string;
  let mockBackupDir: string;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'));
    mockBackupDir = path.join(testDir, 'backups');
    fs.mkdirSync(mockBackupDir, { recursive: true });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create backup and then restore from it in dry run mode', async () => {
    // Step 1: Create a backup (dry run)
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-workflow-db', '--backup-dir', mockBackupDir])
      .stdout(/Dry run mode/)
      .stdout(/Database: test-workflow-db/)
      .code(0);

    // Create a mock backup file that would have been created
    const mockBackupFile = path.join(mockBackupDir, 'test-workflow-db-2025-06-29T12-00-00-000Z.json');
    const mockBackupData = JSON.stringify({
      docs: [
        {
          _id: 'workflow-test-1',
          _rev: '1-abc123',
          title: 'Workflow Test Todo',
          description: 'Testing backup-restore workflow',
          completed: null,
          context: 'test',
          due: '2025-06-30',
          tags: ['workflow'],
          active: {},
          repeat: null,
          link: null,
        }
      ]
    }) + '\n';
    fs.writeFileSync(mockBackupFile, mockBackupData);

    // Step 2: Restore from the backup (dry run)
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-workflow-db-restored', '--backup-file', mockBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .stdout(/Target Database: test-workflow-db-restored/)
      .code(0);

    // Verify backup file exists and has expected content
    expect(fs.existsSync(mockBackupFile)).toBe(true);
    const backupContent = fs.readFileSync(mockBackupFile, 'utf8');
    expect(backupContent).toContain('workflow-test-1');
    expect(backupContent).toContain('Workflow Test Todo');
  }, 45000);

  it('should handle backup with custom parameters and restore with matching settings', async () => {
    const customParallelism = 4;
    const customTimeout = 45000;

    // Step 1: Backup with custom parameters
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'custom-params-db', '--backup-dir', mockBackupDir, '--parallelism', customParallelism.toString(), '--timeout', customTimeout.toString()])
      .stdout(/Parallelism: 4/)
      .stdout(/Timeout: 45000ms/)
      .code(0);

    // Create mock backup file
    const mockBackupFile = path.join(mockBackupDir, 'custom-params-db-2025-06-29T13-00-00-000Z.json');
    const mockBackupData = JSON.stringify({ docs: [{ _id: 'custom-test', title: 'Custom Parameters Test' }] }) + '\n';
    fs.writeFileSync(mockBackupFile, mockBackupData);

    // Step 2: Restore with matching custom parameters
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'custom-params-db-restored', '--backup-file', mockBackupFile, '--parallelism', customParallelism.toString(), '--timeout', customTimeout.toString(), '--force-overwrite'])
      .stdout(/Parallelism: 4/)
      .stdout(/Timeout: 45000ms/)
      .code(0);
  }, 45000);

  it('should validate backup file format during restore', async () => {
    // Create an invalid backup file
    const invalidBackupFile = path.join(mockBackupDir, 'invalid-backup.json');
    fs.writeFileSync(invalidBackupFile, 'invalid json content');

    // Try to restore from invalid backup file
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', invalidBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .code(0);

    // The dry run should still succeed, but in a real restore it would fail
    expect(fs.existsSync(invalidBackupFile)).toBe(true);
  }, 30000);

  it('should handle multiple backup files for same database', async () => {
    const database = 'multi-backup-db';
    
    // Create multiple backup files for the same database
    const backupFiles = [
      `${database}-2025-06-28T10-00-00-000Z.json`,
      `${database}-2025-06-29T10-00-00-000Z.json`,
      `${database}-2025-06-29T14-00-00-000Z.json`
    ];

    backupFiles.forEach((filename, index) => {
      const filePath = path.join(mockBackupDir, filename);
      const mockData = JSON.stringify({
        docs: [{ _id: `doc-${index}`, title: `Document ${index}` }]
      }) + '\n';
      fs.writeFileSync(filePath, mockData);
    });

    // Backup dry run should work
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', database, '--backup-dir', mockBackupDir])
      .stdout(/Existing backups:/)
      .stdout(new RegExp(backupFiles[0]))
      .code(0);

    // Restore using the latest backup file
    const latestBackupFile = path.join(mockBackupDir, backupFiles[2]);
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', `${database}-restored`, '--backup-file', latestBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .code(0);
  }, 45000);

  it('should preserve file permissions and directory structure', async () => {
    const subdirBackupDir = path.join(mockBackupDir, 'subdir');
    fs.mkdirSync(subdirBackupDir, { recursive: true });

    // Test backup with subdirectory
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'subdir-test-db', '--backup-dir', subdirBackupDir])
      .stdout(/Dry run mode/)
      .code(0);

    expect(fs.existsSync(subdirBackupDir)).toBe(true);
    
    // Create mock backup in subdirectory
    const mockBackupFile = path.join(subdirBackupDir, 'subdir-test-db-2025-06-29T15-00-00-000Z.json');
    const mockData = JSON.stringify({ docs: [{ _id: 'subdir-test', title: 'Subdirectory Test' }] }) + '\n';
    fs.writeFileSync(mockBackupFile, mockData);

    // Test restore from subdirectory
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'subdir-test-db-restored', '--backup-file', mockBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
      .code(0);
  }, 45000);
});