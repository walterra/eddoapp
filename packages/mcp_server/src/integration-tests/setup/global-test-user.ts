/**
 * Global test user singleton for MCP integration tests
 * This module ensures the test user is created once and shared across all tests
 */

interface GlobalTestUser {
  userId: string;
  username: string;
  dbName: string;
  telegramId: string;
}

// Global test user singleton
let globalTestUser: GlobalTestUser | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the global test user if not already initialized
 */
async function initializeGlobalTestUser(): Promise<void> {
  if (globalTestUser) {
    return; // Already initialized
  }

  console.log('🔄 GLOBAL SETUP: Initializing global test user...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.COUCHDB_TEST_DB_NAME = 'todos-test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';

  // Ensure COUCHDB_URL is set from the test environment
  if (!process.env.COUCHDB_URL && process.env.COUCHDB_TEST_URL) {
    process.env.COUCHDB_URL = process.env.COUCHDB_TEST_URL;
  }

  // Fallback to default CouchDB URL if not set
  if (!process.env.COUCHDB_URL) {
    process.env.COUCHDB_URL = 'http://admin:password@localhost:5984';
  }

  console.log('🔄 GLOBAL SETUP: Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    COUCHDB_URL: process.env.COUCHDB_URL ? '[SET]' : '[MISSING]',
    COUCHDB_TEST_URL: process.env.COUCHDB_TEST_URL ? '[SET]' : '[MISSING]',
  });

  try {
    const coreServer = await import('@eddo/core-server');
    console.log(
      '🔄 GLOBAL SETUP: Core server imported, available functions:',
      Object.keys(coreServer),
    );

    const { validateEnv, createTestUserRegistry } = coreServer;

    if (!createTestUserRegistry) {
      throw new Error('createTestUserRegistry is not available in @eddo/core-server');
    }

    const env = validateEnv(process.env);
    console.log('🔄 GLOBAL SETUP: Environment validated');

    const userRegistry = await createTestUserRegistry(env.COUCHDB_URL, env);
    console.log('🔄 GLOBAL SETUP: Test user registry created');

    // Set up test user registry database
    if (userRegistry.setupDatabase) {
      await userRegistry.setupDatabase();
    }
    console.log('🔄 GLOBAL SETUP: Test user registry database set up');

    // Create shared test user
    const timestamp = Date.now();
    globalTestUser = {
      userId: `test-user-${timestamp}`,
      username: `testuser_${timestamp}`,
      dbName: `eddo_test_user_testuser_${timestamp}`,
      telegramId: '123456789',
    };

    console.log(`🔄 GLOBAL SETUP: Created global test user object: ${globalTestUser.username}`);

    // Check if test user already exists (cleanup from previous run)
    const existingUser = await userRegistry.findByUsername(globalTestUser.username);
    if (!existingUser) {
      await userRegistry.create({
        username: globalTestUser.username,
        email: 'test@example.com',
        password_hash: 'test-hash',
        telegram_id: parseInt(globalTestUser.telegramId),
        permissions: ['read', 'write'],
        status: 'active',
        version: 'alpha2',
        database_name: globalTestUser.dbName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        preferences: {
          dailyBriefing: false,
          briefingTime: '07:00',
          dailyRecap: false,
          recapTime: '18:00',
        },
      });
      console.log(`✅ Global test user created: ${globalTestUser.username}`);
    } else {
      console.log(`✅ Global test user already exists: ${globalTestUser.username}`);
    }

    console.log('✅ Global test user initialization complete');
  } catch (error) {
    console.error('❌ GLOBAL SETUP ERROR:', error);
    throw error;
  }
}

/**
 * Get the global test user, initializing if necessary
 */
export async function getGlobalTestUser(): Promise<GlobalTestUser> {
  if (!globalTestUser) {
    if (!initializationPromise) {
      initializationPromise = initializeGlobalTestUser();
    }
    await initializationPromise;
  }

  if (!globalTestUser) {
    throw new Error('Failed to initialize global test user');
  }

  return globalTestUser;
}

/**
 * Reset the global test user (for testing purposes)
 */
export function resetGlobalTestUser(): void {
  globalTestUser = null;
  initializationPromise = null;
}
