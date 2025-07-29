import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decodeJwtPayload,
  getTokenExpiration,
  getTokenTimeRemaining,
  isTokenExpired,
} from './token-utils';

describe('token-utils', () => {
  // Mock current time for consistent testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('decodeJwtPayload', () => {
    it('should decode a valid JWT token', () => {
      // This is a test JWT with payload: { "sub": "1234567890", "name": "Test User", "iat": 1516239022, "exp": 1704110400 }
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNzA0MTEwNDAwfQ.signature';
      const payload = decodeJwtPayload(token);

      expect(payload).toEqual({
        sub: '1234567890',
        name: 'Test User',
        iat: 1516239022,
        exp: 1704110400, // 2024-01-01T12:00:00Z
      });
    });

    it('should return null for invalid token format', () => {
      expect(decodeJwtPayload('invalid')).toBeNull();
      expect(decodeJwtPayload('only.two')).toBeNull();
      expect(decodeJwtPayload('')).toBeNull();
    });

    it('should return null for malformed payload', () => {
      const token = 'header.notbase64!@#$.signature';
      expect(decodeJwtPayload(token)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for a non-expired token', () => {
      // Token expires at 2024-01-01T13:00:00Z (1 hour from mock time)
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMTQwMDB9.signature';
      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for an expired token', () => {
      // Token expired at 2024-01-01T11:00:00Z (1 hour before mock time)
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMDY4MDB9.signature';
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for a token expiring exactly now', () => {
      // Token expires at exactly 2024-01-01T12:00:00Z
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMTA0MDB9.signature';
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for invalid tokens', () => {
      expect(isTokenExpired('invalid')).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });

    it('should return true for tokens without exp claim', () => {
      // Token without exp: { "sub": "1234567890" }
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
      expect(isTokenExpired(token)).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return the expiration date for a valid token', () => {
      // Token expires at 2024-01-01T13:00:00Z
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMTQwMDB9.signature';
      const expiration = getTokenExpiration(token);

      expect(expiration).toEqual(new Date('2024-01-01T13:00:00Z'));
    });

    it('should return null for invalid tokens', () => {
      expect(getTokenExpiration('invalid')).toBeNull();
      expect(getTokenExpiration('')).toBeNull();
    });

    it('should return null for tokens without exp claim', () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
      expect(getTokenExpiration(token)).toBeNull();
    });
  });

  describe('getTokenTimeRemaining', () => {
    it('should return milliseconds remaining for non-expired token', () => {
      // Token expires at 2024-01-01T13:00:00Z (1 hour from mock time)
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMTQwMDB9.signature';
      const remaining = getTokenTimeRemaining(token);

      expect(remaining).toBe(3600000); // 1 hour in milliseconds
    });

    it('should return 0 for expired tokens', () => {
      // Token expired at 2024-01-01T11:00:00Z
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDQxMDY4MDB9.signature';
      expect(getTokenTimeRemaining(token)).toBe(0);
    });

    it('should return 0 for invalid tokens', () => {
      expect(getTokenTimeRemaining('invalid')).toBe(0);
      expect(getTokenTimeRemaining('')).toBe(0);
    });

    it('should handle tokens expiring in less than a second', () => {
      // Token expires 100ms from now
      const expTime = Math.floor(Date.now() / 1000) + 0.1;
      const payload = btoa(JSON.stringify({ exp: expTime }));
      const token = `header.${payload}.signature`;

      const remaining = getTokenTimeRemaining(token);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(100);
    });
  });
});
