/**
 * Global test setup for MCP integration tests
 * Note: Server is started externally via npm-run-all before tests run
 */

// Global test user for all tests
let globalTestUser: {
  userId: string;
  username: string;
  dbName: string;
  telegramId: string;
} | null = null;

// Global setup function for Vitest
export async function setup() {
  console.log('🔄 GLOBAL SETUP: Starting global test setup...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.COUCHDB_TEST_DB_NAME = 'todos-test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';

  // Check if test port is available
  const { ensurePortAvailable } = await import('./port-check.js');
  const testPort = parseInt(process.env.MCP_TEST_PORT || '3003', 10);

  try {
    await ensurePortAvailable(testPort);
  } catch (error) {
    console.error(`\n❌ ${error}\n`);
    process.exit(1);
  }

  // Increase timeout for integration tests
  globalThis.setTimeout =
    globalThis.setTimeout ||
    ((cb: () => void, ms: number) => {
      return setTimeout(cb, ms);
    });

  console.log('🚀 MCP Integration Test Suite - Server should already be running');

  // Set up test database infrastructure once (indexes, design documents)
  console.log('🏗️  Setting up shared test database infrastructure...');
  const { DatabaseSetup } = await import('./database-setup.js');
  const dbSetup = new DatabaseSetup();

  // Reset database completely to ensure clean start
  await dbSetup.resetDatabase();

  // Set up test user registry and create shared test user
  console.log('👤 Setting up test user registry and creating shared test user...');

  try {
    const { validateEnv, createTestUserRegistry } = await import('@eddo/core-server');

    const env = validateEnv(process.env);
    console.log('🔄 GLOBAL SETUP: Environment validated');

    // Clean up existing test user registry database first
    console.log('🔄 GLOBAL SETUP: Cleaning up existing test user registry database...');
    const nano = await import('nano');
    const couch = nano.default(env.COUCHDB_URL);
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
  } catch (error) {
    console.error('❌ GLOBAL SETUP ERROR:', error);
    throw error;
  }

  // Additional cleanup to ensure no test data remains
  const { MCPTestServer } = await import('./test-server.js');
  const cleanupServer = new MCPTestServer();
  await cleanupServer.waitForServer();
  await cleanupServer.resetTestData();
  await cleanupServer.stop();

  console.log('✅ Test database infrastructure ready and verified clean');
}

// Global teardown function for Vitest
export async function teardown() {
  console.log('✅ MCP Integration Tests Complete');
}

// Export function to get the global test user
export function getGlobalTestUser() {
  console.log(
    '🔄 GLOBAL SETUP: getGlobalTestUser called, globalTestUser:',
    globalTestUser ? 'exists' : 'null',
  );
  if (!globalTestUser) {
    throw new Error('Global test user not initialized. Make sure beforeAll has run.');
  }
  return globalTestUser;
}

// Extend Vitest's expect with custom matchers if needed
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidTodo(): unknown;
      toBeValidTodoArray(): unknown;
    }
  }
}

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in tests - let vitest handle the error
});
