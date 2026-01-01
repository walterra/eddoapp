/**
 * Global test setup for MCP integration tests
 * Note: Server is started externally via npm-run-all before tests run
 */

import {
  cleanupExistingUserRegistry,
  createTestUserObject,
  ensureTestUserInRegistry,
  type GlobalTestUser,
  resetDatabaseInfrastructure,
  validateTestEnvironment,
  verifyCleanDatabase,
} from './global-helpers.js';

let globalTestUser: GlobalTestUser | null = null;

/**
 * Set up test user registry and create shared test user
 */
async function setupTestUser(): Promise<GlobalTestUser> {
  console.log('👤 Setting up test user registry and creating shared test user...');

  const { validateEnv, createTestUserRegistry } = await import('@eddo/core-server');
  const env = validateEnv(process.env);
  console.log('🔄 GLOBAL SETUP: Environment validated');

  await cleanupExistingUserRegistry(env.COUCHDB_URL);

  const userRegistry = await createTestUserRegistry(env.COUCHDB_URL, env);
  console.log('🔄 GLOBAL SETUP: Test user registry created');

  const testUser = createTestUserObject();
  console.log(`🔄 GLOBAL SETUP: Created global test user object: ${testUser.username}`);

  await ensureTestUserInRegistry(userRegistry, testUser);

  return testUser;
}

export async function setup(): Promise<void> {
  console.log('🔄 GLOBAL SETUP: Starting global test setup...');

  validateTestEnvironment();

  globalThis.setTimeout =
    globalThis.setTimeout || ((cb: () => void, ms: number) => setTimeout(cb, ms));

  console.log('🚀 MCP Integration Test Suite - Server should already be running');

  await resetDatabaseInfrastructure();

  try {
    globalTestUser = await setupTestUser();
  } catch (error) {
    console.error('❌ GLOBAL SETUP ERROR:', error);
    throw error;
  }

  await verifyCleanDatabase();

  console.log('✅ Test database infrastructure ready and verified clean');
}

export async function teardown(): Promise<void> {
  console.log('✅ MCP Integration Tests Complete');
}

export function getGlobalTestUser(): GlobalTestUser {
  console.log(
    '🔄 GLOBAL SETUP: getGlobalTestUser called, globalTestUser:',
    globalTestUser ? 'exists' : 'null',
  );
  if (!globalTestUser) {
    throw new Error('Global test user not initialized. Make sure beforeAll has run.');
  }
  return globalTestUser;
}

declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidTodo(): unknown;
      toBeValidTodoArray(): unknown;
    }
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
