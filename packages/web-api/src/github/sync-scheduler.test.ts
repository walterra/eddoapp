import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGithubSyncScheduler, GithubSyncScheduler } from './sync-scheduler';

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
});
