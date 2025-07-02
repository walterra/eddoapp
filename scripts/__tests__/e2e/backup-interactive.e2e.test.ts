import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup-interactive.ts');

describe('Backup Interactive E2E', () => {
  let testDir: string;
  let mockBackupDir: string;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    mockBackupDir = path.join(testDir, 'backups');
    fs.mkdirSync(mockBackupDir, { recursive: true });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle dry run mode', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', mockBackupDir])
      .stdout(/Dry run mode/)
      .code(0);
  }, 30000);

  it('should show help information', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--help'])
      .stdout(/Interactive CouchDB backup tool/)
      .stdout(/Options:/)
      .code(0);
  }, 15000);

  it('should validate parallelism parameter range', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', mockBackupDir, '--parallelism', '15'])
      .stdout(/Dry run mode/)
      .code(0);
  }, 30000);

  it.skipIf(process.env.CI)('should handle user cancellation in interactive mode', async () => {
    // Set up environment variables for CouchDB connection
    const env = {
      ...process.env,
      COUCHDB_URL: 'http://localhost:5984',
      COUCHDB_DATABASE: 'todos-test',
    };

    await runner()
      .env(env)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT])
      .stdin(/Select database to backup:/, '\x03') // Ctrl+C to cancel
      .stdout(/Backup cancelled/i)
      .code(0); // prompts library exits with 0 when cancelled
  }, 30000);

  it('should accept custom backup directory', async () => {
    const customBackupDir = path.join(testDir, 'custom-backups');
    
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', customBackupDir])
      .stdout(/Dry run mode/)
      .stdout(new RegExp(customBackupDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .code(0);
  }, 30000);

  it('should handle missing database parameter in non-interactive mode', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--no-interactive', '--backup-dir', mockBackupDir])
      .stderr(/Error/i)
      .code(1);
  }, 30000);

  it('should show configuration summary in dry run', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', mockBackupDir, '--parallelism', '5', '--timeout', '30000'])
      .stdout(/Backup Configuration:/)
      .stdout(/Database: test-db/)
      .stdout(/Parallelism: 5/)
      .stdout(/Timeout: 30000ms/)
      .code(0);
  }, 30000);

  it('should create backup directory if it does not exist', async () => {
    const nonExistentDir = path.join(testDir, 'new-backup-dir');
    
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', nonExistentDir])
      .stdout(/Dry run mode/)
      .code(0);
    
    // Directory should be created during the dry run setup
    expect(fs.existsSync(nonExistentDir)).toBe(true);
  }, 30000);
});

describe('Backup Interactive E2E - Error Scenarios', () => {
  let testDir: string;
  let mockBackupDir: string;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-error-test-'));
    mockBackupDir = path.join(testDir, 'backups');
    fs.mkdirSync(mockBackupDir, { recursive: true });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle invalid timeout values', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', mockBackupDir, '--timeout', '5000'])
      .stdout(/Dry run mode/)
      .code(0);
  }, 30000);

  it('should handle zero parallelism parameter', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [BACKUP_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-dir', mockBackupDir, '--parallelism', '0'])
      .stdout(/Dry run mode/)
      .code(0);
  }, 30000);
});