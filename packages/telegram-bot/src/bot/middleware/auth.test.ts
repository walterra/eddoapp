import { Context } from 'grammy';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authMiddleware, isUserAuthorized } from './auth';

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

describe('Authentication Middleware', () => {
  let nextMock: ReturnType<typeof vi.fn<[], Promise<void>>>;

  beforeEach(() => {
    nextMock = vi.fn<[], Promise<void>>();
  });

  function createMockContext(userId?: number): Context {
    return {
      from: userId ? { id: userId } : undefined,
      reply: vi.fn(),
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
    });

    it('should reject unauthorized users', async () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(987654321);
      const mockCtx = createMockContext(123456789);
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
          'If you believe this is an error, please contact the bot administrator.',
      );
      expect(nextMock).not.toHaveBeenCalled();
    });

    it('should allow authorized users', async () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(123456789);
      const mockCtx = createMockContext(123456789);
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).not.toHaveBeenCalled();
      expect(nextMock).toHaveBeenCalled();
    });

    it('should deny all users when allowedUsers is empty', async () => {
      mockAllowedUsers.clear();
      const mockCtx = createMockContext(123456789);
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
          'If you believe this is an error, please contact the bot administrator.',
      );
      expect(nextMock).not.toHaveBeenCalled();
    });
  });
});
