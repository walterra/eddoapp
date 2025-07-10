import { Context } from 'grammy';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authMiddleware, isUserAuthorized } from './auth';

// Mock the logger
vi.mock('../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

// Mock the config module before importing anything that uses it
vi.mock('../../utils/config', () => {
  const mockAllowedUsers = new Set<number>();
  return {
    allowedUsers: mockAllowedUsers,
    appConfig: {} as unknown,
  };
});

// Get reference to the mocked allowedUsers after the mock is set up
const { allowedUsers: mockAllowedUsers } = await import('../../utils/config');
const { logger: mockLogger } = await import('../../utils/logger');

describe('Authentication Middleware', () => {
  let nextMock: ReturnType<typeof vi.fn<[], Promise<void>>>;

  beforeEach(() => {
    nextMock = vi.fn<[], Promise<void>>();
    vi.clearAllMocks();
  });

  function createMockContext(
    userId?: number,
    additionalFromData?: Record<string, unknown>,
  ): Context {
    return {
      from: userId ? { id: userId, ...additionalFromData } : undefined,
      reply: vi.fn(),
      chat: { id: 12345 },
      message: { text: 'test message' },
    } as unknown as Context;
  }

  describe('isUserAuthorized', () => {
    it('should return false when no users are configured', () => {
      mockAllowedUsers.clear();
      expect(isUserAuthorized(123456789)).toBe(false);
    });

    it('should return true for authorized users', () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(123456789);
      mockAllowedUsers.add(987654321);
      expect(isUserAuthorized(123456789)).toBe(true);
      expect(isUserAuthorized(987654321)).toBe(true);
    });

    it('should return false for unauthorized users', () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(123456789);
      expect(isUserAuthorized(555555555)).toBe(false);
    });
  });

  describe('authMiddleware', () => {
    it('should reject when user ID is not available', async () => {
      const mockCtx = createMockContext();
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Unable to verify your identity. Please try again.',
      );
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication failed: No user ID available',
        {
          chat: 12345,
          messageText: 'test message',
        },
      );
    });

    it('should reject unauthorized users', async () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(987654321);
      const mockCtx = createMockContext(123456789, {
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      });
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
          'If you believe this is an error, please contact the bot administrator.',
      );
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        {
          userId: 123456789,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          chatId: 12345,
          messageText: 'test message',
          allowedUsersCount: 1,
        },
      );
    });

    it('should allow authorized users', async () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(123456789);
      const mockCtx = createMockContext(123456789);
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).not.toHaveBeenCalled();
      expect(nextMock).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should deny all users when allowedUsers is empty', async () => {
      mockAllowedUsers.clear();
      const mockCtx = createMockContext(123456789, {
        username: 'emptyconfig',
      });
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
          'If you believe this is an error, please contact the bot administrator.',
      );
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        {
          userId: 123456789,
          username: 'emptyconfig',
          firstName: undefined,
          lastName: undefined,
          chatId: 12345,
          messageText: 'test message',
          allowedUsersCount: 0,
        },
      );
    });
  });
});
