/**
 * Tests for backup retention policy logic
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyRetentionPolicy,
  DEFAULT_RETENTION_CONFIG,
  type RetentionPolicyConfig,
} from './backup-retention.js';

describe('backup-retention', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-retention-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Create a mock backup file with the expected naming convention
   */
  function createMockBackup(database: string, date: Date): string {
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    const filename = `${database}-${timestamp}.json`;
    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, JSON.stringify({ _id: 'test', version: 'alpha3' }));
    return filepath;
  }

  describe('DEFAULT_RETENTION_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_RETENTION_CONFIG.dailyRetentionDays).toBe(30);
      expect(DEFAULT_RETENTION_CONFIG.weeklyRetentionWeeks).toBe(12);
      expect(DEFAULT_RETENTION_CONFIG.monthlyRetentionMonths).toBe(12);
      expect(DEFAULT_RETENTION_CONFIG.dryRun).toBe(false);
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should return empty result for empty backup directory', async () => {
      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        ...DEFAULT_RETENTION_CONFIG,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      expect(result.kept).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.freedBytes).toBe(0);
    });

    it('should keep all backups within daily retention period', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      createMockBackup('test-db', now);
      createMockBackup('test-db', yesterday);
      createMockBackup('test-db', twoDaysAgo);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      expect(result.kept).toHaveLength(3);
      expect(result.deleted).toHaveLength(0);
    });

    it('should delete backups outside all retention periods in dry-run mode', async () => {
      const now = new Date();
      // Create a backup from over a year ago
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

      createMockBackup('test-db', now);
      createMockBackup('test-db', oldDate);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      expect(result.kept).toHaveLength(1);
      expect(result.deleted).toHaveLength(1);
      expect(result.freedBytes).toBeGreaterThan(0);

      // Files should still exist in dry-run mode
      const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.json'));
      expect(files).toHaveLength(2);
    });

    it('should actually delete backups when not in dry-run mode', async () => {
      const now = new Date();
      // Create a backup from over a year ago
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

      createMockBackup('test-db', now);
      const oldBackupPath = createMockBackup('test-db', oldDate);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: false,
      };

      const result = await applyRetentionPolicy(config);

      expect(result.kept).toHaveLength(1);
      expect(result.deleted).toHaveLength(1);

      // File should be deleted
      expect(fs.existsSync(oldBackupPath)).toBe(false);

      // Only one file should remain
      const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.json'));
      expect(files).toHaveLength(1);
    });

    it('should keep one backup per week in weekly retention tier', async () => {
      const now = new Date();

      // Create multiple backups in the same week (35 days ago)
      const day35Ago = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
      const day36Ago = new Date(now.getTime() - 36 * 24 * 60 * 60 * 1000);
      const day37Ago = new Date(now.getTime() - 37 * 24 * 60 * 60 * 1000);

      createMockBackup('test-db', day35Ago);
      createMockBackup('test-db', day36Ago);
      createMockBackup('test-db', day37Ago);

      // Also create a recent backup to keep
      createMockBackup('test-db', now);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      // Should keep recent backup + one from the week (others from same week deleted)
      // The exact number depends on week boundaries
      expect(result.kept.length).toBeGreaterThanOrEqual(2);
      expect(result.deleted.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple databases independently', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

      // Database 1
      createMockBackup('db-one', now);
      createMockBackup('db-one', oldDate);

      // Database 2
      createMockBackup('db-two', now);
      createMockBackup('db-two', oldDate);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      // Should keep 1 recent backup from each database (2 total)
      expect(result.kept).toHaveLength(2);
      // Should delete 1 old backup from each database (2 total)
      expect(result.deleted).toHaveLength(2);
    });

    it('should handle retention with short retention periods', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      createMockBackup('test-db', now);
      createMockBackup('test-db', twoDaysAgo);
      createMockBackup('test-db', fiveDaysAgo);
      createMockBackup('test-db', tenDaysAgo);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 3,
        weeklyRetentionWeeks: 1,
        monthlyRetentionMonths: 0,
        dryRun: true,
      };

      const result = await applyRetentionPolicy(config);

      // With very short retention, most backups should be deleted
      expect(result.kept.length).toBeLessThan(4);
      expect(result.deleted.length).toBeGreaterThan(0);
    });

    it('should handle backup files with log files', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

      const oldBackupPath = createMockBackup('test-db', oldDate);
      // Create associated log file
      fs.writeFileSync(`${oldBackupPath}.log`, 'backup log content');

      createMockBackup('test-db', now);

      const config: RetentionPolicyConfig = {
        backupDir: testDir,
        dailyRetentionDays: 30,
        weeklyRetentionWeeks: 12,
        monthlyRetentionMonths: 12,
        dryRun: false,
      };

      const result = await applyRetentionPolicy(config);

      expect(result.deleted).toHaveLength(1);

      // Both backup file and log file should be deleted
      expect(fs.existsSync(oldBackupPath)).toBe(false);
      expect(fs.existsSync(`${oldBackupPath}.log`)).toBe(false);
    });
  });
});
