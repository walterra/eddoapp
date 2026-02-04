/**
 * Global test user singleton for MCP integration tests
 * This module ensures the test user is created once and shared across all tests
 */
import {
  createDefaultUserPreferences,
  getRandomHex,
  type UserPreferences,
  type UserRegistryEntryAlpha2,
} from '@eddo/core-shared';

interface GlobalTestUser {
  userId: string;
  username: string;
  dbName: string;
  telegramId: string;
  mcpApiKey: string;
}

interface TestUserUpdateDependencies {
  update: (
    id: string,
    updates: Partial<UserRegistryEntryAlpha2>,
  ) => Promise<UserRegistryEntryAlpha2>;
}

interface RegistryUserRecord {
  _id: string;
  preferences?: UserPreferences;
}

// Global test user singleton
let globalTestUser: GlobalTestUser | null = null;
let initializationPromise: Promise<void> | null = null;

/** Set up test environment variables */
function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';

  if (!process.env.COUCHDB_URL) {
    throw new Error('COUCHDB_URL not set - testcontainer setup may have failed');
  }

  console.log('🔄 GLOBAL SETUP: Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    COUCHDB_URL: process.env.COUCHDB_URL ? '[SET]' : '[MISSING]',
  });
}

/** Create the global test user object */
function createTestUserObject(timestamp: number): GlobalTestUser {
  return {
    userId: `test-user-${timestamp}`,
    username: `testuser_${timestamp}`,
    dbName: `eddo_test_user_testuser_${timestamp}`,
    telegramId: '123456789',
    mcpApiKey: `test-${getRandomHex(16)}`,
  };
}

/** Create user data for registry */
function createUserData(user: GlobalTestUser) {
  const basePreferences = createDefaultUserPreferences();

  return {
    username: user.username,
    email: 'test@example.com',
    password_hash: 'test-hash',
    telegram_id: parseInt(user.telegramId),
    permissions: ['read', 'write'] as ['read', 'write'],
    status: 'active' as const,
    version: 'alpha2' as const,
    database_name: user.dbName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preferences: {
      ...basePreferences,
      mcpApiKey: user.mcpApiKey,
    },
  };
}

function shouldUpdateApiKey(
  existingUser: RegistryUserRecord | null,
  expectedApiKey: string,
): boolean {
  if (!existingUser?.preferences?.mcpApiKey) return true;
  return existingUser.preferences.mcpApiKey !== expectedApiKey;
}

async function ensureTestUserApiKey(
  userRegistry: TestUserUpdateDependencies,
  user: GlobalTestUser,
  existingUser: RegistryUserRecord | null,
): Promise<void> {
  const needsUpdate = shouldUpdateApiKey(existingUser, user.mcpApiKey);
  if (!needsUpdate) return;

  const userId = existingUser?._id ?? `user_${user.username}`;
  const basePreferences = existingUser?.preferences ?? createDefaultUserPreferences();
  await userRegistry.update(userId, {
    preferences: {
      ...basePreferences,
      mcpApiKey: user.mcpApiKey,
    },
  });
  console.log(`✅ Global test user API key set: ${user.username}`);
}

/**
 * Initialize the global test user if not already initialized
 */
async function initializeGlobalTestUser(): Promise<void> {
  if (globalTestUser) return;

  console.log('🔄 GLOBAL SETUP: Initializing global test user...');
  setupTestEnvironment();

  try {
    const { validateEnv, createTestUserRegistry } = await import('@eddo/core-server');

    if (!createTestUserRegistry) {
      throw new Error('createTestUserRegistry is not available in @eddo/core-server');
    }

    const env = validateEnv(process.env);
    const userRegistry = await createTestUserRegistry(env.COUCHDB_URL, env);

    if (userRegistry.setupDatabase) {
      await userRegistry.setupDatabase();
    }

    globalTestUser = createTestUserObject(Date.now());
    console.log(`🔄 GLOBAL SETUP: Created global test user object: ${globalTestUser.username}`);

    const existingUser = await userRegistry.findByUsername(globalTestUser.username);
    if (!existingUser) {
      await userRegistry.create(createUserData(globalTestUser));
      console.log(`✅ Global test user created: ${globalTestUser.username}`);
    } else {
      console.log(`✅ Global test user already exists: ${globalTestUser.username}`);
    }

    await ensureTestUserApiKey(userRegistry, globalTestUser, existingUser);

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
