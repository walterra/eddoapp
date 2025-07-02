import { runner } from 'clet';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const RESTORE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'restore-interactive.ts');

describe('Restore Interactive E2E', () => {
  let testDir: string;
  let mockBackupDir: string;
  let mockBackupFile: string;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
    mockBackupDir = path.join(testDir, 'backups');
    fs.mkdirSync(mockBackupDir, { recursive: true });
    
    // Create a mock backup file with valid CouchDB backup format
    mockBackupFile = path.join(mockBackupDir, 'todos-test-2025-06-29T10-00-00-000Z.json');
    const mockBackupData = JSON.stringify({
      docs: [
        {
          _id: 'test1',
          _rev: '1-abc123',
          title: 'Test Todo 1',
          description: 'Test description 1',
          completed: null,
          context: 'test',
          due: '2025-06-30',
          tags: [],
          active: {},
          repeat: null,
          link: null,
        },
        {
          _id: 'test2',
          _rev: '1-def456',
          title: 'Test Todo 2',
          description: 'Test description 2',
          completed: null,
          context: 'test',
          due: '2025-07-01',
          tags: ['urgent'],
          active: {},
          repeat: null,
          link: null,
        }
      ]
    }) + '\n';
    
    fs.writeFileSync(mockBackupFile, mockBackupData);
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle dry run mode', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', mockBackupFile, '--force-overwrite'])
      .stdout(/Dry run mode/)
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
    const nonExistentFile = path.join(testDir, 'nonexistent.json');
    
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', nonExistentFile])
      .stderr(/does not exist/)
      .code(1);
  }, 30000);

  it('should show configuration summary in dry run', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', mockBackupFile, '--parallelism', '3', '--timeout', '25000', '--force-overwrite'])
      .stdout(/Restore Configuration:/)
      .stdout(/Target Database: test-db/)
      .stdout(/Parallelism: 3/)
      .stdout(/Timeout: 25000ms/)
      .code(0);
  }, 30000);

  it('should handle user cancellation without force overwrite', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', 'test-db', '--backup-file', mockBackupFile])
      .stdout(/Restore cancelled - force overwrite not confirmed/)
      .code(0);
  }, 30000);

  it('should accept custom backup directory parameter', async () => {
    const customBackupDir = path.join(testDir, 'custom-backups');
    fs.mkdirSync(customBackupDir, { recursive: true });
    
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', mockBackupFile, '--backup-dir', customBackupDir, '--force-overwrite'])
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
      .spawn('tsx', [RESTORE_SCRIPT])
      .stdin(/Select target database for restore:/, '\x03') // Ctrl+C to cancel
      .stdout(/Restore cancelled/i)
      .code(0); // prompts library exits with 0 when cancelled
  }, 30000);

  it('should validate parallelism parameter range', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--dry-run', '--no-interactive', '--database', 'test-db', '--backup-file', mockBackupFile, '--parallelism', '8', '--force-overwrite'])
      .stdout(/Parallelism: 8/)
      .code(0);
  }, 30000);

  it('should handle missing backup file parameter in non-interactive mode', async () => {
    await runner()
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--no-interactive', '--database', 'test-db'])
      .stderr(/Backup file parameter is required in non-interactive mode/)
      .code(1);
  }, 30000);
});

describe('Restore Interactive E2E - File Discovery', () => {
  let testDir: string;
  let mockBackupDir: string;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-discovery-test-'));
    mockBackupDir = path.join(testDir, 'backups');
    fs.mkdirSync(mockBackupDir, { recursive: true });
    
    // Create multiple mock backup files
    const files = [
      'todos-dev-2025-06-28T09-00-00-000Z.json',
      'todos-prod-2025-06-28T10-00-00-000Z.json',
      'todos-test-2025-06-29T11-00-00-000Z.json'
    ];
    
    files.forEach(filename => {
      const filePath = path.join(mockBackupDir, filename);
      const mockData = JSON.stringify({ docs: [{ _id: 'test', title: 'Test' }] }) + '\n';
      fs.writeFileSync(filePath, mockData);
    });
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.env.CI)('should discover backup files in directory', async () => {
    // This test would be interactive in real use, but we test the discovery mechanism
    // by checking that the command doesn't immediately fail when backup files exist
    const env = {
      ...process.env,
      COUCHDB_URL: 'http://localhost:5984',
      COUCHDB_DATABASE: 'todos-test',
    };

    // Start the command and cancel immediately to test file discovery
    await runner()
      .env(env)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--backup-dir', mockBackupDir])
      .stdin(/Select target database for restore:/, '\x03') // Cancel after discovery
      .stdout(/Restore cancelled/i)
      .code(0);
  }, 30000);

  it.skipIf(process.env.CI)('should handle empty backup directory', async () => {
    const emptyBackupDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyBackupDir, { recursive: true });
    
    const env = {
      ...process.env,
      COUCHDB_URL: 'http://localhost:5984',
      COUCHDB_DATABASE: 'todos-test',
    };

    await runner()
      .env(env)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [RESTORE_SCRIPT, '--backup-dir', emptyBackupDir])
      .stdin(/Select target database for restore:/, '\x03') // Cancel at first prompt
      .stdout(/Restore cancelled/i)
      .code(0);
  }, 30000);
});