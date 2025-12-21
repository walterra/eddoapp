/**
 * Tests for GitHub bot commands
 */
import type { Env } from '@eddo/core-server';
import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Context } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelegramUser } from '../../utils/user-lookup';

// Mock dependencies
vi.mock('@eddo/core-server', () => ({
  createEnv: vi.fn(),
  createUserRegistry: vi.fn(),
}));

vi.mock('../../utils/user-lookup', () => ({
  lookupUserByTelegramId: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { invalidateUserCache, lookupUserByTelegramId } from '../../utils/user-lookup';
import { handleGithub } from './github';

describe('GitHub Bot Commands', () => {
  const mockUserRegistry = {
    update: vi.fn(),
  };

  const mockEnv = {
    COUCHDB_URL: 'http://localhost:5984',
  };

  const mockUser: TelegramUser = {
    _id: 'user_test',
    username: 'testuser',
    email: 'test@example.com',
    telegram_id: 12345,
    database_name: 'eddo_user_test',
    status: 'active',
    permissions: ['read', 'write'],
    created_at: '2025-12-21T10:00:00Z',
    updated_at: '2025-12-21T10:00:00Z',
    preferences: {
      dailyBriefing: false,
      briefingTime: '07:00',
      printBriefing: false,
      dailyRecap: false,
      recapTime: '18:00',
      printRecap: false,
      viewMode: 'kanban',
      tableColumns: ['title', 'due', 'tags'],
      selectedTags: [],
      selectedContexts: [],
      selectedStatus: 'all',
      selectedTimeRange: { type: 'current-week' },
      githubSync: false,
      githubToken: null,
      githubSyncInterval: 60,
      githubSyncTags: ['github', 'gtd:next'],
      githubLastSync: undefined,
      githubSyncStartedAt: undefined,
    },
  };

  const createMockContext = (text: string): Partial<Context> => ({
    from: { id: 12345 } as Context['from'],
    message: { text } as Context['message'],
    reply: vi.fn().mockResolvedValue({}),
    deleteMessage: vi.fn().mockResolvedValue({}),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createEnv).mockReturnValue(mockEnv as Env);
    vi.mocked(createUserRegistry).mockReturnValue(
      mockUserRegistry as unknown as ReturnType<typeof createUserRegistry>,
    );
    vi.mocked(lookupUserByTelegramId).mockResolvedValue(mockUser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enableGithubSync (/github on)', () => {
    it('should enable GitHub sync and set githubSyncStartedAt', async () => {
      const ctx = createMockContext('/github on');
      const userWithToken = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          githubToken: 'ghp_test_token',
        },
      };

      vi.mocked(lookupUserByTelegramId).mockResolvedValue(userWithToken);

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).toHaveBeenCalledWith(
        'user_test',
        expect.objectContaining({
          preferences: expect.objectContaining({
            githubSync: true,
            githubSyncStartedAt: expect.any(String),
          }),
          updated_at: expect.any(String),
        }),
      );

      expect(invalidateUserCache).toHaveBeenCalledWith(12345);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ **GitHub sync enabled!**'),
      );
    });

    it('should fail if no token is set', async () => {
      const ctx = createMockContext('/github on');

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ **GitHub token not set!**'),
      );
    });
  });

  describe('disableGithubSync (/github off)', () => {
    it('should disable GitHub sync and invalidate cache', async () => {
      const ctx = createMockContext('/github off');

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).toHaveBeenCalledWith(
        'user_test',
        expect.objectContaining({
          preferences: expect.objectContaining({
            githubSync: false,
          }),
          updated_at: expect.any(String),
        }),
      );

      expect(invalidateUserCache).toHaveBeenCalledWith(12345);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ **GitHub sync disabled.**'),
      );
    });
  });

  describe('setGithubToken (/github token)', () => {
    it('should save valid GitHub token and invalidate cache', async () => {
      const ctx = createMockContext('/github token ghp_valid_token_123');

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).toHaveBeenCalledWith(
        'user_test',
        expect.objectContaining({
          preferences: expect.objectContaining({
            githubToken: 'ghp_valid_token_123',
          }),
          updated_at: expect.any(String),
        }),
      );

      expect(invalidateUserCache).toHaveBeenCalledWith(12345);
      expect(ctx.deleteMessage).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('✅ **GitHub token saved!**'));
    });

    it('should show warning for invalid token format', async () => {
      const ctx = createMockContext('/github token invalid_token');

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('⚠️ **Warning:**'));
    });

    it('should show usage when no token provided', async () => {
      const ctx = createMockContext('/github token');

      await handleGithub(ctx as Context);

      expect(mockUserRegistry.update).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('❌ **No token provided!**'));
    });
  });

  describe('showGithubStatus (/github status)', () => {
    it('should show current configuration', async () => {
      const ctx = createMockContext('/github status');
      const userWithConfig = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          githubSync: true,
          githubToken: 'ghp_test_token_12345',
          githubSyncInterval: 30,
          githubLastSync: '2025-12-21T10:00:00Z',
        },
      };

      vi.mocked(lookupUserByTelegramId).mockResolvedValue(userWithConfig);

      await handleGithub(ctx as Context);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('📊 **GitHub Sync Status**'));
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('✅ **Status:** Enabled'));
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Every 30 minutes'));
    });
  });

  describe('showGithubHelp (/github)', () => {
    it('should display help when no subcommand provided', async () => {
      const ctx = createMockContext('/github');

      await handleGithub(ctx as Context);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('🐙 **GitHub Issue Sync**'));
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('**Commands:**'));
    });
  });
});
