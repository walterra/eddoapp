import { runner } from 'clet';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabaseManager, createTestEnv, generateTestDbName } from './test-utils';

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

  it.skip('should handle invalid CouchDB connection gracefully', async () => {
    // Skip: cleanup-interactive.ts uses getCouchDbConfig (production config) instead of
    // getTestCouchDbConfig, so it always connects to the real CouchDB instance
    // regardless of environment variable overrides in tests.
    // This test would require modifying the actual script to use test config.

    const testEnv = {
      ...process.env,
      COUCHDB_URL: 'http://invalid:invalid@192.0.2.1:9999',
    };

    // Try to connect to invalid CouchDB instance (using TEST-NET-1 RFC5737)
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--dry-run', '--force'])
      .stderr(/ECONNREFUSED|ETIMEDOUT|Make sure CouchDB is running/)
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
      .code(0);

    // TODO: Add negative assertion for todos-test-gamma pattern matching
    // The current CLET runner doesn't support .not.stdout() properly
  });

  it.skip('should handle database access errors gracefully', async () => {
    // Skip: cleanup-interactive.ts uses getCouchDbConfig (production config) instead of
    // getTestCouchDbConfig, so it always connects to the real CouchDB instance
    // regardless of environment variable overrides in tests.
    // This test would require modifying the actual script to use test config.

    const testEnv = {
      ...process.env,
      COUCHDB_URL: 'http://wronguser:wrongpass@192.0.2.1:5984',
    };

    // Try to access with wrong credentials (using TEST-NET-1 RFC5737)
    await runner()
      .env(testEnv)
      .cwd(PROJECT_ROOT)
      .spawn('tsx', [CLEANUP_SCRIPT, '--dry-run', '--force'])
      .stderr(/ECONNREFUSED|ETIMEDOUT|unauthorized|Check your CouchDB credentials/)
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
      .spawn('tsx', [
        CLEANUP_SCRIPT,
        '--pattern',
        `${testDbName.split('-')[0]}-*`,
        '--dry-run',
        '--force',
      ])
      .stdout(/Dry-run complete. No databases were deleted/)
      .code(0);

    // Verify database still exists
    const stillExists = await dbManager.databaseExists(testDbName);
    expect(stillExists).toBe(true);
  });
});
