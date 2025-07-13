import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock console.warn to check warning messages
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock environment variables
const mockEnv = {
  TELEGRAM_BOT_TOKEN: 'mock-token',
  ANTHROPIC_API_KEY: 'mock-key',
  MCP_API_KEY: 'mock-mcp-key',
};

// Mock the shared environment validation
vi.mock('@eddo/core', () => ({
  validateEnv: vi.fn(() => ({})),
}));

// Mock dotenv
vi.mock('dotenv-mono', () => ({
  dotenvLoad: vi.fn(),
}));

describe('Config Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWarn.mockClear();
    // Reset process.env to clean state
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('TELEGRAM_')) {
        delete process.env[key];
      }
    });
    // Set required env vars
    Object.assign(process.env, mockEnv);
  });

  describe('parseAllowedUsers', () => {
    it('should return empty set for undefined input', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = undefined;
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set());
    });

    it('should return empty set for empty string', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set());
    });

    it('should return empty set for whitespace-only string', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '   ';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set());
    });

    it('should parse valid single user ID', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '123456789';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([123456789]));
    });

    it('should parse multiple valid user IDs', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '123456789,987654321,555555555';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([123456789, 987654321, 555555555]));
    });

    it('should handle user IDs with spaces', async () => {
      process.env.TELEGRAM_ALLOWED_USERS =
        ' 123456789 , 987654321 , 555555555 ';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([123456789, 987654321, 555555555]));
    });

    it('should skip invalid format user IDs with warning', async () => {
      process.env.TELEGRAM_ALLOWED_USERS =
        '123456789,invalid,987654321,not-a-number';
      vi.resetModules();
      const { allowedUsers } = await import('./config');

      expect(allowedUsers).toEqual(new Set([123456789, 987654321]));
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid user ID format: "invalid" - skipping'),
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid user ID format: "not-a-number" - skipping',
        ),
      );
    });

    it('should skip user IDs that are too small with warning', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '0,-1,123456789';
      vi.resetModules();
      const { allowedUsers } = await import('./config');

      expect(allowedUsers).toEqual(new Set([123456789]));
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid user ID: 0 - User ID must be positive - skipping',
        ),
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid user ID: -1 - User ID must be positive - skipping',
        ),
      );
    });

    it('should skip user IDs that are too large with warning', async () => {
      process.env.TELEGRAM_ALLOWED_USERS =
        '1000000000000,123456789,9999999999999';
      vi.resetModules();
      const { allowedUsers } = await import('./config');

      expect(allowedUsers).toEqual(new Set([123456789]));
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid user ID: 1000000000000 - User ID too large for Telegram platform - skipping',
        ),
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid user ID: 9999999999999 - User ID too large for Telegram platform - skipping',
        ),
      );
    });

    it('should handle edge case of maximum valid user ID', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '999999999999';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([999999999999]));
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should handle edge case of minimum valid user ID', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '1';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([1]));
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should skip empty comma-separated values', async () => {
      process.env.TELEGRAM_ALLOWED_USERS = '123456789,,987654321,,,555555555';
      vi.resetModules();
      const { allowedUsers } = await import('./config');
      expect(allowedUsers).toEqual(new Set([123456789, 987654321, 555555555]));
    });

    it('should handle mixed valid and invalid user IDs', async () => {
      process.env.TELEGRAM_ALLOWED_USERS =
        '123456789,0,invalid,987654321,1000000000000,555555555';
      vi.resetModules();
      const { allowedUsers } = await import('./config');

      expect(allowedUsers).toEqual(new Set([123456789, 987654321, 555555555]));
      expect(mockConsoleWarn).toHaveBeenCalledTimes(3); // 3 invalid entries
    });
  });
});
