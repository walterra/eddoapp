/**
 * Unit tests for GitHub API rate limit utilities
 */
import { describe, expect, it } from 'vitest';

import {
  extractRateLimitHeaders,
  formatResetTime,
  getRateLimitPercentage,
  isRateLimitError,
  shouldWarnAboutRateLimit,
  type RateLimitInfo,
} from './rate-limit';

describe('extractRateLimitHeaders', () => {
  it('should extract valid rate limit headers', () => {
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1703260800', // 2023-12-22 16:00:00 UTC
      'x-ratelimit-used': '500',
    };

    const result = extractRateLimitHeaders(headers);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(5000);
    expect(result?.remaining).toBe(4500);
    expect(result?.reset).toBe(1703260800);
    expect(result?.used).toBe(500);
    expect(result?.resetDate).toBeInstanceOf(Date);
  });

  it('should handle numeric headers', () => {
    const headers = {
      'x-ratelimit-limit': 5000,
      'x-ratelimit-remaining': 4500,
      'x-ratelimit-reset': 1703260800,
      'x-ratelimit-used': 500,
    };

    const result = extractRateLimitHeaders(headers);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(5000);
  });

  it('should return null when headers are missing', () => {
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      // Missing reset and used
    };

    const result = extractRateLimitHeaders(headers);

    expect(result).toBeNull();
  });

  it('should return null when headers are invalid numbers', () => {
    const headers = {
      'x-ratelimit-limit': 'invalid',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1703260800',
      'x-ratelimit-used': '500',
    };

    const result = extractRateLimitHeaders(headers);

    expect(result).toBeNull();
  });

  it('should return null when headers are negative', () => {
    const headers = {
      'x-ratelimit-limit': '-5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1703260800',
      'x-ratelimit-used': '500',
    };

    const result = extractRateLimitHeaders(headers);

    expect(result).toBeNull();
  });

  it('should convert Unix timestamp to Date correctly', () => {
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1703260800', // 2023-12-22 16:00:00 UTC
      'x-ratelimit-used': '500',
    };

    const result = extractRateLimitHeaders(headers);

    expect(result?.resetDate.getTime()).toBe(1703260800000);
  });
});

describe('isRateLimitError', () => {
  it('should identify rate limit errors by message', () => {
    const error = new Error('GitHub API rate limit exceeded');
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should identify rate limit errors with different casing', () => {
    const error = new Error('API RATE LIMIT EXCEEDED');
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should identify ratelimit errors (single word)', () => {
    const error = new Error('ratelimit exceeded');
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should return false for non-rate-limit errors', () => {
    const error = new Error('Network connection failed');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isRateLimitError('not an error')).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(123)).toBe(false);
  });
});

describe('formatResetTime', () => {
  it('should format time in the past', () => {
    const pastDate = new Date(Date.now() - 60000); // 1 minute ago
    const result = formatResetTime(pastDate);
    expect(result).toBe('now (limit should be reset)');
  });

  it('should format time less than 1 minute away', () => {
    const soonDate = new Date(Date.now() + 30000); // 30 seconds (rounds to 1 minute)
    const result = formatResetTime(soonDate);
    expect(result).toBe('in 1 minute');
  });

  it('should format time in minutes (singular)', () => {
    const oneMinute = new Date(Date.now() + 90000); // 1.5 minutes (rounds to 2)
    const result = formatResetTime(oneMinute);
    expect(result).toMatch(/^in \d+ minutes?$/);
  });

  it('should format time in minutes (plural)', () => {
    const fiveMinutes = new Date(Date.now() + 300000); // 5 minutes
    const result = formatResetTime(fiveMinutes);
    expect(result).toBe('in 5 minutes');
  });

  it('should format time today with AM/PM', () => {
    const today = new Date();
    today.setHours(today.getHours() + 2); // 2 hours from now
    const result = formatResetTime(today);
    expect(result).toMatch(/^at \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('should format time tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 30); // 2:30 PM tomorrow
    const result = formatResetTime(tomorrow);
    expect(result).toMatch(/^tomorrow at \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('should format future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = formatResetTime(future);
    expect(result).toMatch(/^on (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} at/);
  });
});

describe('shouldWarnAboutRateLimit', () => {
  const createRateLimitInfo = (limit: number, remaining: number): RateLimitInfo => ({
    limit,
    remaining,
    reset: 1703260800,
    resetDate: new Date(1703260800000),
    used: limit - remaining,
  });

  it('should warn when below default threshold (20%)', () => {
    const info = createRateLimitInfo(5000, 900); // 18%
    expect(shouldWarnAboutRateLimit(info)).toBe(true);
  });

  it('should warn at exactly 20%', () => {
    const info = createRateLimitInfo(5000, 1000); // 20%
    expect(shouldWarnAboutRateLimit(info)).toBe(true);
  });

  it('should not warn when above threshold', () => {
    const info = createRateLimitInfo(5000, 1100); // 22%
    expect(shouldWarnAboutRateLimit(info)).toBe(false);
  });

  it('should support custom threshold', () => {
    const info = createRateLimitInfo(5000, 1500); // 30%
    expect(shouldWarnAboutRateLimit(info, 40)).toBe(true); // 30% < 40%
    expect(shouldWarnAboutRateLimit(info, 25)).toBe(false); // 30% > 25%
  });

  it('should not warn when limit is 0', () => {
    const info = createRateLimitInfo(0, 0);
    expect(shouldWarnAboutRateLimit(info)).toBe(false);
  });

  it('should not warn when remaining is 0 (already hit limit)', () => {
    const info = createRateLimitInfo(5000, 0);
    expect(shouldWarnAboutRateLimit(info)).toBe(false);
  });

  it('should warn when almost exhausted', () => {
    const info = createRateLimitInfo(5000, 50); // 1%
    expect(shouldWarnAboutRateLimit(info)).toBe(true);
  });
});

describe('getRateLimitPercentage', () => {
  const createRateLimitInfo = (limit: number, remaining: number): RateLimitInfo => ({
    limit,
    remaining,
    reset: 1703260800,
    resetDate: new Date(1703260800000),
    used: limit - remaining,
  });

  it('should calculate percentage correctly', () => {
    const info = createRateLimitInfo(5000, 2500);
    expect(getRateLimitPercentage(info)).toBe(50);
  });

  it('should round to nearest integer', () => {
    const info = createRateLimitInfo(5000, 2501);
    expect(getRateLimitPercentage(info)).toBe(50); // 50.02% rounds to 50
  });

  it('should return 100 when fully available', () => {
    const info = createRateLimitInfo(5000, 5000);
    expect(getRateLimitPercentage(info)).toBe(100);
  });

  it('should return 0 when fully exhausted', () => {
    const info = createRateLimitInfo(5000, 0);
    expect(getRateLimitPercentage(info)).toBe(0);
  });

  it('should return 0 when limit is 0', () => {
    const info = createRateLimitInfo(0, 0);
    expect(getRateLimitPercentage(info)).toBe(0);
  });

  it('should handle small percentages', () => {
    const info = createRateLimitInfo(5000, 50);
    expect(getRateLimitPercentage(info)).toBe(1);
  });

  it('should handle high percentages', () => {
    const info = createRateLimitInfo(5000, 4950);
    expect(getRateLimitPercentage(info)).toBe(99);
  });
});
