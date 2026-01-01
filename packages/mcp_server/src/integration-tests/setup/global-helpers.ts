/**
 * Helper functions for global test setup
 */
import type { UserRegistryOperations } from '@eddo/core-shared';

/** Global test user structure */
export interface GlobalTestUser {
  userId: string;
  username: string;
  dbName: string;
  telegramId: string;
}

/**
 * Clean up existing test user registry database
 */
export async function cleanupExistingUserRegistry(couchUrl: string): Promise<void> {
  console.log('🔄 GLOBAL SETUP: Cleaning up existing test user registry database...');
  const nano = await import('nano');
  const couch = nano.default(couchUrl);
  const testUserRegistryDbName = 'todos-test_user_registry';

  try {
    await couch.db.destroy(testUserRegistryDbName);
    console.log('🔄 GLOBAL SETUP: Existing test user registry database deleted');
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      console.log('🔄 GLOBAL SETUP: Test user registry database does not exist');
    } else {
      console.warn(
        '🔄 GLOBAL SETUP: Failed to delete existing test user registry database:',
        error,
      );
    }
  }
}

/**
 * Create global test user object with unique timestamp
 */
export function createTestUserObject(): GlobalTestUser {
  const timestamp = Date.now();
  return {
    userId: `test-user-${timestamp}`,
    username: `testuser_${timestamp}`,
    dbName: `eddo_test_user_testuser_${timestamp}`,
    telegramId: '123456789',
  };
}

/**
 * Create or verify test user in registry
 */
export async function ensureTestUserInRegistry(
  userRegistry: UserRegistryOperations,
  testUser: GlobalTestUser,
): Promise<void> {
  if (userRegistry.setupDatabase) {
    await userRegistry.setupDatabase();
  }
  console.log('🔄 GLOBAL SETUP: Test user registry database set up');

  const existingUser = await userRegistry.findByUsername(testUser.username);
  if (existingUser) {
    console.log(`✅ Global test user already exists: ${testUser.username}`);
    return;
  }

  const now = new Date().toISOString();
  await userRegistry.create({
    username: testUser.username,
    email: 'test@example.com',
    password_hash: 'test-hash',
    telegram_id: parseInt(testUser.telegramId),
    permissions: ['read', 'write'] as const,
    status: 'active' as const,
    version: 'alpha2' as const,
    database_name: testUser.dbName,
    created_at: now,
    updated_at: now,
    preferences: {
      dailyBriefing: false,
      briefingTime: '07:00',
      dailyRecap: false,
      recapTime: '18:00',
    },
  });
  console.log(`✅ Global test user created: ${testUser.username}`);
}

/**
 * Verify clean database with MCP server
 */
export async function verifyCleanDatabase(): Promise<void> {
  const { MCPTestServer } = await import('./test-server.js');
  const cleanupServer = new MCPTestServer();
  await cleanupServer.waitForServer();
  await cleanupServer.resetTestData();
  await cleanupServer.stop();
}

/**
 * Validate test environment
 */
export function validateTestEnvironment(): void {
  if (!process.env.COUCHDB_URL) {
    console.error('❌ GLOBAL SETUP: COUCHDB_URL not set!');
    console.error('   This means testcontainer setup failed in run-integration-tests.js');
    throw new Error('COUCHDB_URL not set - testcontainer setup may have failed');
  }

  console.log('✅ GLOBAL SETUP: Using CouchDB URL:', process.env.COUCHDB_URL);
  process.env.NODE_ENV = 'test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';
}

/**
 * Reset database with fresh setup
 */
export async function resetDatabaseInfrastructure(): Promise<void> {
  console.log('🏗️  Setting up shared test database infrastructure...');
  const { DatabaseSetup } = await import('./database-setup.js');
  const dbSetup = new DatabaseSetup();
  await dbSetup.resetDatabase();
}
