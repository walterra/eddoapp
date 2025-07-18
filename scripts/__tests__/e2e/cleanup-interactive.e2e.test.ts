import { runner } from 'clet';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabaseManager, generateTestDbName, createTestEnv } from './test-utils';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const CLEANUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'cleanup-interactive.ts');

describe('Cleanup Interactive E2E', () => {
  let dbManager: TestDatabaseManager;
  
  beforeEach(() => {
    dbManager = new TestDatabaseManager();
  });
  
  afterEach(async () => {
    await dbManager.cleanupAll();
  });

  it('should handle non-existent databases gracefully', async () => {
    const testEnv = createTestEnv();
    
    // Try to cleanup a pattern that matches no databases
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--pattern', 'nonexistent-db-*', '--dry-run', '--force'])
      .stdout(/No databases match the cleanup criteria/)
      .code(0);
  });

  it('should handle invalid CouchDB connection gracefully', async () => {
    const testEnv = {
      ...createTestEnv(),
      COUCHDB_URL: 'http://invalid:invalid@invalid-host:9999'
    };
    
    // Try to connect to invalid CouchDB instance
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--dry-run', '--force'])
      .stderr(/ECONNREFUSED|Make sure CouchDB is running/)
      .code(1);
  });

  it('should correctly identify and filter test databases', async () => {
    const testEnv = createTestEnv();
    
    // Create test databases with different patterns
    const testDbs = [
      generateTestDbName('eddo-test'),
      generateTestDbName('test-workflow'),
      'todos-test-example',
      'production-db', // This should NOT be matched
    ];
    
    // Create only the test databases (not the production one)
    for (const dbName of testDbs.slice(0, 3)) {
      await dbManager.createTestDatabase(dbName);
    }
    
    // Run cleanup in dry-run mode for all test databases
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--mode', 'all', '--dry-run', '--force'])
      .stdout(/Databases to be cleaned \(dry-run\):/)
      .stdout(new RegExp(testDbs[0])) // Should find first test db
      .stdout(new RegExp(testDbs[1])) // Should find second test db
      .stdout(new RegExp(testDbs[2])) // Should find third test db
      .code(0);
  });

  it('should correctly match pattern-based filtering', async () => {
    const testEnv = createTestEnv();
    
    // Create databases with specific patterns
    const testDbs = [
      'test-alpha-123',
      'test-beta-456',
      'todos-test-gamma', // Should NOT match "test-*" pattern
    ];
    
    for (const dbName of testDbs) {
      await dbManager.createTestDatabase(dbName);
    }
    
    // Run cleanup with pattern that should only match "test-*" databases
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--pattern', 'test-*', '--dry-run', '--force'])
      .stdout(/Databases to be cleaned \(dry-run\):/)
      .stdout(/test-alpha-123/) // Should match
      .stdout(/test-beta-456/) // Should match
      .not.stdout(/todos-test-gamma/) // Should NOT match
      .code(0);
  });

  it('should handle database access errors gracefully', async () => {
    const testEnv = {
      ...createTestEnv(),
      COUCHDB_URL: 'http://wronguser:wrongpass@localhost:5984'
    };
    
    // Try to access with wrong credentials
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--dry-run', '--force'])
      .stderr(/unauthorized|Check your CouchDB credentials/)
      .code(1);
  });

  it('should respect dry-run mode and not delete databases', async () => {
    const testEnv = createTestEnv();
    
    // Create a test database
    const testDbName = generateTestDbName('cleanup-dryrun');
    await dbManager.createTestDatabase(testDbName);
    
    // Run cleanup in dry-run mode
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--pattern', `${testDbName.split('-')[0]}-*`, '--dry-run', '--force'])
      .stdout(/Dry-run complete. No databases were deleted/)
      .code(0);
    
    // Verify database still exists
    const stillExists = await dbManager.databaseExists(testDbName);
    expect(stillExists).toBe(true);
  });
});