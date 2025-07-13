import { Context } from 'grammy';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_AUTH_FAILURES,
  authFailures,
  authMiddleware,
  isRateLimited,
  isUserAuthorized,
  recordAuthFailure,
} from './auth';

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
    appConfig: {
      TELEGRAM_LOG_USER_DETAILS: false,
    },
  };
});

// Get reference to the mocked allowedUsers after the mock is set up
const { allowedUsers: mockAllowedUsers } = await import('../../utils/config');
const { logger: mockLogger } = await import('../../utils/logger');

describe('Authentication Middleware', () => {
  let nextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextMock = vi.fn();
    vi.clearAllMocks();
    // Clear auth failures between tests
    authFailures.clear();
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

    it('should reject unauthorized users with remaining attempts message', async () => {
      mockAllowedUsers.clear();
      mockAllowedUsers.add(987654321);
      const mockCtx = createMockContext(123456789, {
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      });
      await authMiddleware(mockCtx, nextMock);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
            '4 attempts remaining before temporary restriction.',
        ),
      );
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        expect.objectContaining({
          userId: 123456789,
          chatId: 12345,
          messageText: 'test message',
          allowedUsersCount: 1,
          failureCount: 1,
          rateLimited: false,
        }),
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
        expect.stringContaining(
          '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
            '4 attempts remaining before temporary restriction.',
        ),
      );
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        expect.objectContaining({
          userId: 123456789,
          chatId: 12345,
          messageText: 'test message',
          allowedUsersCount: 0,
          failureCount: 1,
          rateLimited: false,
        }),
      );
    });
  });

  describe('Rate Limiting', () => {
    describe('recordAuthFailure', () => {
      it('should record first auth failure', () => {
        const userId = 123456789;
        recordAuthFailure(userId);

        const record = authFailures.get(userId);
        expect(record).toBeDefined();
        expect(record?.count).toBe(1);
        expect(record?.firstFailure).toBeLessThanOrEqual(Date.now());
        expect(record?.lastFailure).toBeLessThanOrEqual(Date.now());
      });

      it('should increment failure count for repeated failures', () => {
        const userId = 123456789;

        recordAuthFailure(userId);
        recordAuthFailure(userId);
        recordAuthFailure(userId);

        const record = authFailures.get(userId);
        expect(record?.count).toBe(3);
      });
    });

    describe('isRateLimited', () => {
      it('should return false for users with no failures', () => {
        expect(isRateLimited(123456789)).toBe(false);
      });

      it('should return false for users below failure threshold', () => {
        const userId = 123456789;

        // Record failures below threshold
        for (let i = 0; i < MAX_AUTH_FAILURES - 1; i++) {
          recordAuthFailure(userId);
        }

        expect(isRateLimited(userId)).toBe(false);
      });

      it('should return true for users at failure threshold', () => {
        const userId = 123456789;

        // Record failures at threshold
        for (let i = 0; i < MAX_AUTH_FAILURES; i++) {
          recordAuthFailure(userId);
        }

        expect(isRateLimited(userId)).toBe(true);
      });

      it('should return true for users above failure threshold', () => {
        const userId = 123456789;

        // Record failures above threshold
        for (let i = 0; i < MAX_AUTH_FAILURES + 2; i++) {
          recordAuthFailure(userId);
        }

        expect(isRateLimited(userId)).toBe(true);
      });
    });

    describe('authMiddleware with rate limiting', () => {
      it('should rate limit after max failures', async () => {
        mockAllowedUsers.clear();
        mockAllowedUsers.add(987654321); // Different user is allowed

        const unauthorizedUserId = 123456789;
        const mockCtx = createMockContext(unauthorizedUserId, {
          username: 'unauthorized',
        });

        // Make max failures
        for (let i = 0; i < MAX_AUTH_FAILURES; i++) {
          const ctx = createMockContext(unauthorizedUserId, {
            username: 'unauthorized',
          });
          await authMiddleware(ctx, nextMock);
        }

        // Next attempt should be rate limited
        await authMiddleware(mockCtx, nextMock);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          '⏰ Too many unauthorized attempts. Please wait 15 minutes before trying again.\n\n' +
            'If you believe this is an error, please contact the bot administrator.',
        );
        expect(nextMock).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Rate limited user attempted access',
          expect.objectContaining({
            userId: unauthorizedUserId,
          }),
        );
      });

      it('should show rate limit message when threshold is reached', async () => {
        mockAllowedUsers.clear();
        mockAllowedUsers.add(987654321); // Different user is allowed

        const unauthorizedUserId = 123456789;

        // Make failures up to threshold - 1
        for (let i = 0; i < MAX_AUTH_FAILURES - 1; i++) {
          const ctx = createMockContext(unauthorizedUserId, {
            username: 'unauthorized',
          });
          await authMiddleware(ctx, nextMock);
        }

        // Final failure that triggers rate limiting
        const mockCtx = createMockContext(unauthorizedUserId, {
          username: 'unauthorized',
        });
        await authMiddleware(mockCtx, nextMock);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          '🚫 Too many unauthorized attempts. Access has been temporarily restricted.\n\n' +
            'Please wait 15 minutes before trying again. If you believe this is an error, please contact the bot administrator.',
        );
        expect(nextMock).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Unauthorized access attempt',
          expect.objectContaining({
            userId: unauthorizedUserId,
            rateLimited: true,
            failureCount: MAX_AUTH_FAILURES,
          }),
        );
      });

      it('should show remaining attempts before rate limiting', async () => {
        mockAllowedUsers.clear();
        mockAllowedUsers.add(987654321); // Different user is allowed

        const unauthorizedUserId = 123456789;
        const mockCtx = createMockContext(unauthorizedUserId, {
          username: 'unauthorized',
        });

        // First failure
        await authMiddleware(mockCtx, nextMock);

        const remainingAttempts = MAX_AUTH_FAILURES - 1;
        expect(mockCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining(
            `${remainingAttempts} attempts remaining before temporary restriction.`,
          ),
        );
      });

      it('should not affect authorized users', async () => {
        mockAllowedUsers.clear();
        const authorizedUserId = 123456789;
        mockAllowedUsers.add(authorizedUserId);

        // Record some failures for this user (simulating previous unauthorized attempts)
        for (let i = 0; i < MAX_AUTH_FAILURES; i++) {
          recordAuthFailure(authorizedUserId);
        }

        // User should still be able to access if they become authorized
        const mockCtx = createMockContext(authorizedUserId);
        await authMiddleware(mockCtx, nextMock);

        expect(mockCtx.reply).not.toHaveBeenCalled();
        expect(nextMock).toHaveBeenCalled();
      });
    });
  });

  describe('PII Logging Configuration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      authFailures.clear();
      mockAllowedUsers.clear();
    });

    it('should not log PII when TELEGRAM_LOG_USER_DETAILS is false', async () => {
      // The default configuration should have PII logging disabled
      const mockCtx = createMockContext(123456789, {
        username: 'testuser',
        first_name: 'John',
        last_name: 'Doe',
      });
      await authMiddleware(mockCtx, nextMock);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        expect.not.objectContaining({
          username: 'testuser',
          firstName: 'John',
          lastName: 'Doe',
        }),
      );

      // Should still log non-PII fields
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        expect.objectContaining({
          userId: 123456789,
          chatId: 12345,
          messageText: 'test message',
        }),
      );
    });

    it('should respect the PII logging configuration', async () => {
      // This test verifies that the auth middleware uses the configuration correctly
      // Since our mock has TELEGRAM_LOG_USER_DETAILS set to false, PII should not be logged
      const mockCtx = createMockContext(123456789, {
        username: 'testuser',
        first_name: 'John',
        last_name: 'Doe',
      });
      await authMiddleware(mockCtx, nextMock);

      // Verify the current config setting is respected
      const { appConfig } = await import('../../utils/config');

      if (appConfig.TELEGRAM_LOG_USER_DETAILS) {
        // If PII logging is enabled, expect PII fields
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Unauthorized access attempt',
          expect.objectContaining({
            username: 'testuser',
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
      } else {
        // If PII logging is disabled, ensure no PII fields
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Unauthorized access attempt',
          expect.not.objectContaining({
            username: 'testuser',
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
      }
    });

    it('should not log PII in rate limited attempts when disabled', async () => {
      const userId = 123456789;
      // Record failures to trigger rate limiting
      for (let i = 0; i < MAX_AUTH_FAILURES; i++) {
        recordAuthFailure(userId);
      }

      const mockCtx = createMockContext(userId, {
        username: 'testuser',
      });
      await authMiddleware(mockCtx, nextMock);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limited user attempted access',
        expect.not.objectContaining({
          username: 'testuser',
        }),
      );
    });
  });
});
