/**
 * Tests for interactive backup CLI
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBackupConfig } from './backup-interactive-prompts.js';

// Mock prompts
vi.mock('prompts', () => ({
  default: vi.fn(),
}));

// Mock fs
vi.mock('fs');

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

// Mock fetch for database discovery
global.fetch = vi.fn();

describe('backup-interactive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(['eddo-test', 'test-db']),
    } as Response);
  });

  describe('getBackupConfig', () => {
    it('should return config when all options provided including url', async () => {
      const options = {
        url: 'http://admin:password@localhost:5984',
        database: 'custom-db',
        backupDir: './custom-backups',
        parallelism: 3,
        timeout: 30000,
        dryRun: true,
      };

      const config = await getBackupConfig(options);

      expect(config).toMatchObject({
        url: expect.stringContaining('localhost:5984'),
        database: 'custom-db',
        backupDir: './custom-backups',
        parallelism: 3,
        timeout: 30000,
        dryRun: true,
      });
    });

    it('should prompt for URL when not provided', async () => {
      const prompts = await import('prompts');
      // Mock multiple prompts calls
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ url: 'http://admin:password@localhost:5984' })
        .mockResolvedValueOnce({ database: 'eddo-test' })
        .mockResolvedValueOnce({
          backupDir: './backups',
          parallelism: 5,
          timeout: 60000,
        });

      await getBackupConfig({});

      expect(prompts.default).toHaveBeenCalled();
      const firstCall = vi.mocked(prompts.default).mock.calls[0][0] as { name?: string };
      expect(firstCall.name).toBe('url');
    });

    it('should fetch available databases when URL is provided', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default).mockResolvedValue({
        database: 'eddo-test',
        backupDir: './backups',
        parallelism: 5,
        timeout: 60000,
      });

      await getBackupConfig({ url: 'http://admin:password@localhost:5984' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/_all_dbs'),
        expect.any(Object),
      );
    });

    it('should handle process exit on cancel', async () => {
      const prompts = await import('prompts');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      vi.mocked(prompts.default).mockImplementation((_questions, options) => {
        if (options?.onCancel) {
          options.onCancel();
        }
        return Promise.resolve({});
      });

      await expect(getBackupConfig({})).rejects.toThrow('Process exit called');
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('validation', () => {
    it('should validate parallelism range in prompts', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ url: 'http://admin:password@localhost:5984' })
        .mockResolvedValueOnce({ database: 'test-db' })
        .mockResolvedValueOnce({
          backupDir: './backups',
          parallelism: 5,
          timeout: 60000,
        });

      await getBackupConfig({});

      // Find the call that has parallelism prompt
      const allCalls = vi.mocked(prompts.default).mock.calls;
      let parallelismPrompt: { min?: number; max?: number } | undefined;

      for (const call of allCalls) {
        const questions = call[0];
        if (Array.isArray(questions)) {
          const found = questions.find((q: { name?: string }) => q.name === 'parallelism');
          if (found) {
            parallelismPrompt = found;
            break;
          }
        }
      }

      expect(parallelismPrompt).toBeDefined();
      expect(parallelismPrompt!.min).toBe(1);
      expect(parallelismPrompt!.max).toBe(10);
    });

    it('should validate timeout minimum in prompts', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ url: 'http://admin:password@localhost:5984' })
        .mockResolvedValueOnce({ database: 'test-db' })
        .mockResolvedValueOnce({
          backupDir: './backups',
          parallelism: 5,
          timeout: 60000,
        });

      await getBackupConfig({});

      // Find the call that has timeout prompt
      const allCalls = vi.mocked(prompts.default).mock.calls;
      let timeoutPrompt: { min?: number } | undefined;

      for (const call of allCalls) {
        const questions = call[0];
        if (Array.isArray(questions)) {
          const found = questions.find((q: { name?: string }) => q.name === 'timeout');
          if (found) {
            timeoutPrompt = found;
            break;
          }
        }
      }

      expect(timeoutPrompt).toBeDefined();
      expect(timeoutPrompt!.min).toBe(10000);
    });

    it('should validate URL format', async () => {
      const prompts = await import('prompts');
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ url: 'http://admin:password@localhost:5984' })
        .mockResolvedValueOnce({ database: 'test-db' })
        .mockResolvedValueOnce({
          backupDir: './backups',
          parallelism: 5,
          timeout: 60000,
        });

      await getBackupConfig({});

      // URL prompt is the first call
      const firstCall = vi.mocked(prompts.default).mock.calls[0][0] as {
        name?: string;
        validate?: (value: string) => string | boolean;
      };

      expect(firstCall.name).toBe('url');
      expect(firstCall.validate).toBeDefined();

      // Test validation function
      expect(firstCall.validate!('')).toBe('URL is required');
      expect(firstCall.validate!('not-a-url')).toBe('Invalid URL format');
      expect(firstCall.validate!('http://localhost:5984')).toBe(true);
    });
  });
});
