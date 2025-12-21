import type { TodoAlpha3 } from '@eddo/core-server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGithubSyncScheduler, GithubSyncScheduler, hasTodoChanged } from './sync-scheduler';

describe('GithubSyncScheduler', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockDb = {
    insert: vi.fn(),
    list: vi.fn(),
  };

  const mockGetUserDb = vi.fn().mockReturnValue(mockDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Factory function', () => {
    it('should create scheduler instance', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 60000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      expect(scheduler).toBeInstanceOf(GithubSyncScheduler);
      expect(mockLogger.info).toHaveBeenCalledWith('GitHub sync scheduler created', {
        checkIntervalMs: 60000,
      });
    });
  });

  describe('start/stop', () => {
    it('should start scheduler', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 60000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('GitHub sync scheduler started');

      scheduler.stop();
    });

    it('should stop scheduler', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 60000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('GitHub sync scheduler stopped');
    });

    it('should warn if starting already running scheduler', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 60000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      scheduler.start();
      scheduler.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('GitHub sync scheduler is already running');

      scheduler.stop();
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 30000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        checkIntervalMs: 30000,
      });
    });

    it('should reflect running state', () => {
      const scheduler = createGithubSyncScheduler({
        checkIntervalMs: 60000,
        logger: mockLogger,
        getUserDb: mockGetUserDb,
      });

      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });
  });

  describe('hasTodoChanged', () => {
    const baseTodo: TodoAlpha3 = {
      _id: '2025-01-01T00:00:00.000Z',
      _rev: '1-abc123',
      title: 'Test Issue',
      description: 'Test description',
      context: 'elastic/kibana',
      due: '2025-01-15T00:00:00.000Z',
      tags: ['github', 'gtd:next'],
      active: {},
      completed: null,
      repeat: null,
      link: 'https://github.com/elastic/kibana/issues/123',
      version: 'alpha3' as const,
      externalId: 'github:123',
    };

    it('should return false when todos are identical', () => {
      const updated = { ...baseTodo };
      expect(hasTodoChanged(baseTodo, updated)).toBe(false);
    });

    it('should return false when only _rev changed (PouchDB metadata)', () => {
      const updated = { ...baseTodo, _rev: '2-def456' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(false);
    });

    it('should return true when title changed', () => {
      const updated = { ...baseTodo, title: 'Updated Title' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when description changed', () => {
      const updated = { ...baseTodo, description: 'Updated description' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when context changed', () => {
      const updated = { ...baseTodo, context: 'different/repo' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when due date changed', () => {
      const updated = { ...baseTodo, due: '2025-02-01T00:00:00.000Z' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when tags changed', () => {
      const updated = { ...baseTodo, tags: ['github', 'bug'] };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when tags order changed', () => {
      const updated = { ...baseTodo, tags: ['gtd:next', 'github'] };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when active tracking changed', () => {
      const updated = { ...baseTodo, active: { '2025-01-01': '2025-01-01T10:00:00.000Z' } };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when completed status changed', () => {
      const updated = { ...baseTodo, completed: '2025-01-10T00:00:00.000Z' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when repeat changed', () => {
      const updated = { ...baseTodo, repeat: 7 };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when link changed', () => {
      const updated = { ...baseTodo, link: 'https://github.com/elastic/kibana/issues/456' };
      expect(hasTodoChanged(baseTodo, updated)).toBe(true);
    });

    it('should return true when link changes from null to value', () => {
      const todoWithoutLink = { ...baseTodo, link: null };
      const updated = { ...todoWithoutLink, link: 'https://example.com' };
      expect(hasTodoChanged(todoWithoutLink, updated)).toBe(true);
    });

    it('should return false for empty active objects', () => {
      const updated = { ...baseTodo, active: {} };
      expect(hasTodoChanged(baseTodo, updated)).toBe(false);
    });

    it('should detect deep changes in active object', () => {
      const todoWithActive = {
        ...baseTodo,
        active: { '2025-01-01': '2025-01-01T10:00:00.000Z' },
      };
      const updated = {
        ...todoWithActive,
        active: { '2025-01-01': '2025-01-01T11:00:00.000Z' }, // Time changed
      };
      expect(hasTodoChanged(todoWithActive, updated)).toBe(true);
    });
  });
});
