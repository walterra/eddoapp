/**
 * Tests for interactive backup CLI
 * Run manually with: npx tsx scripts/backup-interactive.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { getBackupConfig } from './backup-interactive.js';

// Mock dependencies
vi.mock('@eddo/core/config', () => ({
  validateEnv: vi.fn(() => ({
    COUCHDB_URL: 'http://localhost:5984',
    COUCHDB_USERNAME: 'admin',
    COUCHDB_PASSWORD: 'password',
    COUCHDB_DATABASE: 'eddo-test',
  })),
  getCouchDbConfig: vi.fn(() => ({
    dbName: 'eddo-test',
    fullUrl: 'http://admin:password@localhost:5984/eddo-test',
  })),
  getAvailableDatabases: vi.fn(() => Promise.resolve(['eddo-test', 'test-db'])),
}));

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

vi.mock('fs');

describe('backup-interactive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBackupConfig', () => {
    it('should return defaults when all options provided', async () => {
      const options = {
        database: 'custom-db',
        backupDir: './custom-backups',
        parallelism: 3,
        timeout: 30000,
        dryRun: true,
      };

      const config = await getBackupConfig(options);

      expect(config).toEqual({
        database: 'custom-db',
        backupDir: './custom-backups',
        parallelism: 3,
        timeout: 30000,
        dryRun: true,
      });
    });

    it('should use environment defaults when no options provided', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default).mockResolvedValue({
        database: 'eddo-test',
        backupDir: './backups',
        parallelism: 5,
        timeout: 60000,
      });

      const config = await getBackupConfig({});

      expect(config).toEqual({
        database: 'eddo-test',
        backupDir: './backups',
        parallelism: 5,
        timeout: 60000,
        dryRun: false,
      });
      
      expect(prompts.default).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'database' }),
          expect.objectContaining({ name: 'backupDir' }),
          expect.objectContaining({ name: 'parallelism' }),
          expect.objectContaining({ name: 'timeout' }),
        ]),
        expect.any(Object)
      );
    });

    it('should prompt only for missing values', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default).mockResolvedValue({
        backupDir: './custom-backups',
      });

      const options = {
        database: 'provided-db',
        parallelism: 3,
        timeout: 30000,
      };

      await getBackupConfig(options);

      expect(prompts.default).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'backupDir' }),
        ]),
        expect.any(Object)
      );
      
      // Should not prompt for already provided values
      const calls = vi.mocked(prompts.default).mock.calls[0][0] as any[];
      const promptNames = calls.map(call => call.name);
      expect(promptNames).not.toContain('database');
      expect(promptNames).not.toContain('parallelism');
      expect(promptNames).not.toContain('timeout');
    });

    it('should handle process exit on cancel', async () => {
      const prompts = await import('prompts');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });
      
      const mockCancel = vi.fn(() => {
        console.log('Backup cancelled.');
        process.exit(0);
      });

      vi.mocked(prompts.default).mockImplementation(() => {
        mockCancel();
        return Promise.resolve({});
      });

      await expect(getBackupConfig({})).rejects.toThrow('Process exit called');
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('validation', () => {
    it('should validate parallelism range', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default).mockResolvedValue({
        database: 'test-db',
        backupDir: './backups',
        parallelism: 15, // Above max
        timeout: 60000,
      });

      await getBackupConfig({});

      const calls = vi.mocked(prompts.default).mock.calls[0][0] as any[];
      const parallelismPrompt = calls.find(call => call.name === 'parallelism');
      
      expect(parallelismPrompt).toBeDefined();
      expect(parallelismPrompt.min).toBe(1);
      expect(parallelismPrompt.max).toBe(10);
    });

    it('should validate timeout minimum', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default).mockResolvedValue({
        database: 'test-db',
        backupDir: './backups',
        parallelism: 5,
        timeout: 5000, // Below min
      });

      await getBackupConfig({});

      const calls = vi.mocked(prompts.default).mock.calls[0][0] as any[];
      const timeoutPrompt = calls.find(call => call.name === 'timeout');
      
      expect(timeoutPrompt).toBeDefined();
      expect(timeoutPrompt.min).toBe(10000);
    });
  });
});