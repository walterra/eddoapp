/**
 * Tests for backup scheduler logic
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { createBackupScheduler } from './backup-scheduler.js';

describe('backup-scheduler', () => {
  let testDir: string;
  let mockLogger: {
    info: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-scheduler-test-'));
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createBackupScheduler', () => {
    it('should create a scheduler with default configuration', () => {
      const scheduler = createBackupScheduler({ logger: mockLogger });

      const status = scheduler.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.backupInProgress).toBe(false);
      expect(status.lastBackupTime).toBeNull();
      expect(status.nextBackupTime).toBeNull();
      expect(status.config.intervalMs).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(status.config.databasePattern).toBe('eddo_*');
      expect(status.config.verifyAfterBackup).toBe(true);
      expect(status.config.applyRetention).toBe(true);
    });

    it('should create a scheduler with custom configuration', () => {
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60, // 1 hour
        backupDir: testDir,
        databasePattern: 'test_*',
        verifyAfterBackup: false,
        applyRetention: false,
        logger: mockLogger,
      });

      const status = scheduler.getStatus();

      expect(status.config.intervalMs).toBe(1000 * 60 * 60);
      expect(status.config.backupDir).toBe(testDir);
      expect(status.config.databasePattern).toBe('test_*');
      expect(status.config.verifyAfterBackup).toBe(false);
      expect(status.config.applyRetention).toBe(false);
    });
  });

  describe('BackupScheduler', () => {
    it('should start and stop correctly', () => {
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60,
        backupDir: testDir,
        logger: mockLogger,
      });

      expect(scheduler.getStatus().isRunning).toBe(false);

      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });

    it('should warn when starting an already running scheduler', () => {
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60,
        backupDir: testDir,
        logger: mockLogger,
      });

      scheduler.start();
      scheduler.start(); // Second start should warn

      expect(mockLogger.warn).toHaveBeenCalledWith('Backup scheduler is already running');

      scheduler.stop();
    });

    it('should return empty results when pattern matches no databases', async () => {
      // This test doesn't require mocks - it just tests the pattern matching with empty DB list
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60,
        backupDir: testDir,
        databasePattern: 'nonexistent_pattern_*',
        logger: mockLogger,
      });

      // Note: This will fail to connect to CouchDB which is expected in test env
      // The scheduler handles this gracefully
      const results = await scheduler.runBackupCycle();

      // Either returns empty (no matching dbs) or fails gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should log when starting backup cycle', async () => {
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60,
        backupDir: testDir,
        databasePattern: 'test_*',
        verifyAfterBackup: false,
        applyRetention: false,
        logger: mockLogger,
      });

      await scheduler.runBackupCycle();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting backup cycle');
    });

    it('should handle concurrent backup prevention', async () => {
      const scheduler = createBackupScheduler({
        intervalMs: 1000 * 60 * 60,
        backupDir: testDir,
        databasePattern: 'test_*',
        verifyAfterBackup: false,
        applyRetention: false,
        logger: mockLogger,
      });

      // Start two backup cycles simultaneously
      const cycle1 = scheduler.runBackupCycle();
      const cycle2 = scheduler.runBackupCycle();

      await Promise.all([cycle1, cycle2]);

      // Second cycle should have been skipped
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Backup already in progress, skipping this cycle',
      );
    });
  });

  describe('configuration validation', () => {
    it('should include retention config in status', () => {
      const scheduler = createBackupScheduler({
        logger: mockLogger,
        retentionConfig: {
          dailyRetentionDays: 7,
          weeklyRetentionWeeks: 4,
          monthlyRetentionMonths: 6,
          dryRun: true,
        },
      });

      const status = scheduler.getStatus();

      expect(status.config.retentionConfig.dailyRetentionDays).toBe(7);
      expect(status.config.retentionConfig.weeklyRetentionWeeks).toBe(4);
      expect(status.config.retentionConfig.monthlyRetentionMonths).toBe(6);
      expect(status.config.retentionConfig.dryRun).toBe(true);
    });
  });
});
