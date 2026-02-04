/**
 * Helper functions for TestAgentServer
 * Extracted to reduce function complexity
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UserPermissions, UserPreferences, UserStatus } from '@eddo/core-shared';
import { getRandomHex, getRandomInt, REQUIRED_INDEXES } from '@eddo/core-shared';
import nano from 'nano';
import { vi } from 'vitest';

import type { MockTelegramContext } from './test-agent-server.js';

/** Test user data structure matching the user registry */
export interface TestUser {
  _id: string;
  username: string;
  email: string;
  telegram_id: number;
  database_name: string;
  status: UserStatus;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
  preferences: UserPreferences;
}

export interface TestUserRegistryUpdater {
  update: (id: string, updates: { preferences: UserPreferences }) => Promise<unknown>;
}

export interface RegistryUserRecord {
  _id: string;
  preferences?: UserPreferences;
}

/** Default test user preferences */
const DEFAULT_TEST_PREFERENCES: UserPreferences = {
  dailyBriefing: false,
  briefingTime: '07:00',
  dailyRecap: false,
  recapTime: '18:00',
};

export function buildTestUserPreferences(
  basePreferences: UserPreferences | undefined,
  apiKey: string,
  setAt: string,
): UserPreferences {
  const base = basePreferences ?? DEFAULT_TEST_PREFERENCES;
  return {
    ...base,
    mcpApiKey: apiKey,
    mcpApiKeySetAt: setAt,
  };
}

/**
 * Generate unique test user data
 */
export function generateTestUserData(preferences?: UserPreferences): TestUser {
  const timestamp = Date.now();
  const telegramId = 12345 + getRandomInt(10000);
  const username = `testuser_${timestamp}`;
  const databaseName = `eddo_test_user_${username}`;
  const now = new Date().toISOString();
  const userPreferences = preferences ?? { ...DEFAULT_TEST_PREFERENCES };

  return {
    _id: username,
    username,
    email: `${username}@test.example.com`,
    telegram_id: telegramId,
    database_name: databaseName,
    status: 'active',
    permissions: ['read', 'write'],
    created_at: now,
    updated_at: now,
    preferences: userPreferences,
  };
}

/**
 * Generate unique test API key
 */
export function generateTestApiKey(): string {
  return `agent-test-${Date.now()}-${getRandomHex(9)}`;
}

/**
 * Create user database with required indexes
 */
export async function setupUserDatabase(couchDbUrl: string, databaseName: string): Promise<void> {
  const couch = nano(couchDbUrl);

  // Create the user's todo database
  try {
    await couch.db.create(databaseName);
  } catch (err: any) {
    if (err.statusCode !== 412) {
      throw err;
    }
  }

  // Create required indexes
  const userDb = couch.use(databaseName);
  for (const indexDef of REQUIRED_INDEXES) {
    try {
      await userDb.createIndex(indexDef);
    } catch (err: any) {
      if (err.statusCode !== 409) {
        throw err;
      }
    }
  }
}

/**
 * Build user registry entry from test user data
 */
export function buildUserRegistryEntry(testUser: TestUser) {
  return {
    username: testUser.username,
    email: testUser.email,
    password_hash: 'test-hash',
    telegram_id: testUser.telegram_id,
    permissions: testUser.permissions,
    status: testUser.status,
    version: 'alpha2' as const,
    database_name: testUser.database_name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preferences: testUser.preferences,
  };
}

function shouldUpdateApiKey(existingUser: RegistryUserRecord, apiKey: string): boolean {
  if (!existingUser.preferences?.mcpApiKey) return true;
  return existingUser.preferences.mcpApiKey !== apiKey;
}

export async function ensureRegistryApiKey(
  userRegistry: TestUserRegistryUpdater,
  registryUser: RegistryUserRecord,
  apiKey: string,
  setAt: string,
): Promise<void> {
  if (!shouldUpdateApiKey(registryUser, apiKey)) return;

  const preferences = buildTestUserPreferences(registryUser.preferences, apiKey, setAt);
  await userRegistry.update(registryUser._id, { preferences });
}

/**
 * Create mock reply function
 */
function createMockReply(replies: string[]) {
  return vi.fn(async (text: string) => {
    replies.push(text);
    return {} as any;
  });
}

/**
 * Create mock chat action function
 */
function createMockChatAction(chatActions: string[]) {
  return vi.fn(async (action: string) => {
    chatActions.push(action);
    return true;
  });
}

/**
 * Build mock Telegram context from test user
 */
export function buildMockContext(testUser: TestUser): MockTelegramContext {
  const replies: string[] = [];
  const chatActions: string[] = [];
  const telegramId = testUser.telegram_id;

  return {
    replies,
    chatActions,
    reply: createMockReply(replies),
    replyWithChatAction: createMockChatAction(chatActions),
    from: {
      id: telegramId,
      is_bot: false,
      first_name: 'Test',
      username: testUser.username,
    },
    chat: {
      id: telegramId,
      type: 'private',
      first_name: 'Test',
      username: testUser.username,
    },
    message: {
      message_id: 1,
      date: Date.now(),
      chat: {
        id: telegramId,
        type: 'private',
        first_name: 'Test',
        username: testUser.username,
      },
      from: {
        id: telegramId,
        is_bot: false,
        first_name: 'Test',
        username: testUser.username,
      },
      text: '',
    },
    session: {
      userId: testUser.username,
      lastActivity: new Date(),
      context: {},
      user: testUser,
    },
  };
}
