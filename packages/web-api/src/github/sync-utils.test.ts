/**
 * Tests for GitHub sync utility functions
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { describe, expect, it, vi } from 'vitest';

import { findTodoByExternalId, shouldSyncUser } from './sync-utils';

interface MockDb {
  find: ReturnType<typeof vi.fn>;
}

describe('GitHub Sync Utils', () => {
  describe('shouldSyncUser', () => {
    it('should return true when user never synced before', () => {
      const result = shouldSyncUser({
        githubLastSync: undefined,
        githubSyncInterval: 60,
      });

      expect(result).toBe(true);
    });

    it('should return true when sync interval has elapsed', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const result = shouldSyncUser({
        githubLastSync: twoHoursAgo,
        githubSyncInterval: 60, // 60 minutes
      });

      expect(result).toBe(true);
    });

    it('should return false when sync interval has not elapsed', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const result = shouldSyncUser({
        githubLastSync: fiveMinutesAgo,
        githubSyncInterval: 60, // 60 minutes
      });

      expect(result).toBe(false);
    });

    it('should use default interval of 60 minutes when not specified', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const result = shouldSyncUser({
        githubLastSync: twoHoursAgo,
        // No githubSyncInterval specified, defaults to 60
      });

      expect(result).toBe(true);
    });

    it('should handle undefined preferences', () => {
      const result = shouldSyncUser(undefined);

      expect(result).toBe(true);
    });
  });

  describe('findTodoByExternalId', () => {
    const mockLogger = {
      error: vi.fn(),
    };

    it('should find existing todo by externalId', async () => {
      const existingTodo: TodoAlpha3 = {
        _id: '2025-12-21T09:00:00.000Z',
        _rev: '1-abc',
        active: {},
        completed: null,
        context: 'work',
        description: 'Test issue',
        due: '',
        externalId: 'github:owner/repo/issues/42',
        link: 'https://github.com/owner/repo/issues/42',
        repeat: null,
        tags: ['github'],
        title: 'Test Issue',
        version: 'alpha3',
      };

      const mockDb: MockDb = {
        find: vi.fn().mockResolvedValue({
          docs: [existingTodo],
        }),
      };

      const result = await findTodoByExternalId(
        mockDb as unknown as Parameters<typeof findTodoByExternalId>[0],
        'github:owner/repo/issues/42',
        mockLogger,
      );

      expect(result).toEqual(existingTodo);
      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {
          externalId: { $eq: 'github:owner/repo/issues/42' },
        },
        limit: 1,
        use_index: 'externalId-index',
      });
    });

    it('should return null if todo not found', async () => {
      const mockDb: MockDb = {
        find: vi.fn().mockResolvedValue({
          docs: [],
        }),
      };

      const result = await findTodoByExternalId(
        mockDb as unknown as Parameters<typeof findTodoByExternalId>[0],
        'github:owner/repo/issues/42',
        mockLogger,
      );

      expect(result).toBeNull();
    });

    it('should return null and log error on database failure', async () => {
      const mockDb: MockDb = {
        find: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      const result = await findTodoByExternalId(
        mockDb as unknown as Parameters<typeof findTodoByExternalId>[0],
        'github:owner/repo/issues/42',
        mockLogger,
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to find todo by externalId', {
        externalId: 'github:owner/repo/issues/42',
        error: expect.any(Error),
      });
    });
  });
});
