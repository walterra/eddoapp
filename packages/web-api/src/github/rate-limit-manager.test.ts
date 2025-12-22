/**
 * Unit tests for GitHub API rate limit manager
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRateLimitManager } from './rate-limit-manager';

describe('RateLimitManager', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request throttling', () => {
    it('should execute function successfully', async () => {
      const manager = createRateLimitManager({
        maxRetries: 3,
        baseDelayMs: 1000,
        minRequestIntervalMs: 10, // Short interval for test
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      const result = await manager.executeWithRateLimit(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('Automatic retry with exponential backoff', () => {
    it('should retry on rate limit error', async () => {
      const manager = createRateLimitManager({
        maxRetries: 2,
        baseDelayMs: 10, // Short delay for test
        minRequestIntervalMs: 5,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      let attemptCount = 0;
      const mockFn = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('GitHub API rate limit exceeded');
        }
        return 'success';
      });

      const result = await manager.executeWithRateLimit(mockFn);

      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw after max retries exceeded', async () => {
      const manager = createRateLimitManager({
        maxRetries: 1,
        baseDelayMs: 10,
        minRequestIntervalMs: 5,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      const mockFn = vi.fn(async () => {
        throw new Error('GitHub API rate limit exceeded');
      });

      await expect(manager.executeWithRateLimit(mockFn)).rejects.toThrow(
        'GitHub API rate limit exceeded',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not retry on non-rate-limit errors', async () => {
      const manager = createRateLimitManager({
        maxRetries: 3,
        baseDelayMs: 10,
        minRequestIntervalMs: 5,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      const mockFn = vi.fn(async () => {
        throw new Error('Network connection failed');
      });

      await expect(manager.executeWithRateLimit(mockFn)).rejects.toThrow(
        'Network connection failed',
      );
      expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Rate limit monitoring', () => {
    it('should track last rate limit info', () => {
      const manager = createRateLimitManager({
        maxRetries: 3,
        baseDelayMs: 1000,
        minRequestIntervalMs: 100,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      // Initially null
      expect(manager.getLastRateLimitInfo()).toBeNull();
    });
  });

  describe('Request queueing', () => {
    it('should process requests sequentially', async () => {
      const manager = createRateLimitManager({
        maxRetries: 3,
        baseDelayMs: 10,
        minRequestIntervalMs: 5,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      const executionOrder: number[] = [];

      const promises = [
        manager.executeWithRateLimit(async () => {
          executionOrder.push(1);
          return 'first';
        }),
        manager.executeWithRateLimit(async () => {
          executionOrder.push(2);
          return 'second';
        }),
        manager.executeWithRateLimit(async () => {
          executionOrder.push(3);
          return 'third';
        }),
      ];

      await Promise.all(promises);

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Error propagation', () => {
    it('should propagate rate limit errors', async () => {
      const manager = createRateLimitManager({
        maxRetries: 1,
        baseDelayMs: 10,
        minRequestIntervalMs: 5,
        warningThresholdPercent: 20,
        logger: mockLogger,
      });

      const mockFn = vi.fn(async () => {
        throw new Error('API rate limit exceeded');
      });

      await expect(manager.executeWithRateLimit(mockFn)).rejects.toThrow('API rate limit exceeded');
    });
  });
});
