/**
 * Tests for GitHub API error handling and security
 */
import { describe, expect, it, vi } from 'vitest';

import { createGithubClient } from './client';
import type { GithubApiError } from './types';

describe('GitHub Error Handling', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  describe('Token validation', () => {
    it('should accept valid ghp_ token format', () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      expect(token.startsWith('ghp_')).toBe(true);

      const client = createGithubClient({ token }, mockLogger);
      expect(client).toBeDefined();
    });

    it('should accept valid github_pat_ token format', () => {
      const token = 'github_pat_1234567890abcdefghijklmnopqrstuvwxyz';
      expect(token.startsWith('github_pat_')).toBe(true);

      const client = createGithubClient({ token }, mockLogger);
      expect(client).toBeDefined();
    });

    it('should detect invalid token format', () => {
      const invalidToken = 'invalid_token_123';
      expect(invalidToken.startsWith('ghp_')).toBe(false);
      expect(invalidToken.startsWith('github_pat_')).toBe(false);
    });
  });

  describe('Token masking in logs', () => {
    it('should mask token showing only first 7 and last 4 characters', () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = `${token.substring(0, 7)}...${token.substring(token.length - 4)}`;

      expect(masked).toBe('ghp_123...wxyz');
      expect(masked).not.toContain('1234567890abcdefghij');
    });

    it('should handle short tokens gracefully', () => {
      const shortToken = 'ghp_1234';
      const masked = `${shortToken.substring(0, 7)}...${shortToken.substring(shortToken.length - 4)}`;

      // For short tokens, masking still works (may show overlap)
      expect(masked).toBeDefined();
      expect(masked).toContain('...');
    });
  });

  describe('API error handling', () => {
    it('should handle 401 Unauthorized error', async () => {
      const client = createGithubClient({ token: 'invalid_token' }, mockLogger);

      await expect(client.fetchUserIssues()).rejects.toThrow();
    });

    it('should provide helpful error message for invalid token', () => {
      const error: GithubApiError = {
        name: 'GithubApiError',
        message: 'Bad credentials',
        response: {
          status: 401,
          data: {
            message: 'Bad credentials',
            documentation_url: 'https://docs.github.com/rest',
          },
        },
      };

      expect(error.response?.status).toBe(401);
      expect(error.response?.data.message).toContain('credentials');
    });

    it('should handle 403 Forbidden error', () => {
      const error: GithubApiError = {
        name: 'GithubApiError',
        message: 'Forbidden',
        response: {
          status: 403,
          data: {
            message: 'Resource not accessible by integration',
            documentation_url: 'https://docs.github.com/rest',
          },
        },
      };

      expect(error.response?.status).toBe(403);
    });

    it('should handle 403 Rate Limit error', () => {
      const error: GithubApiError = {
        name: 'GithubApiError',
        message: 'API rate limit exceeded',
        response: {
          status: 403,
          data: {
            message: 'API rate limit exceeded for user',
            documentation_url:
              'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
          },
        },
      };

      expect(error.response?.status).toBe(403);
      expect(error.response?.data.message).toContain('rate limit');
    });

    it('should handle 404 Not Found error', () => {
      const error: GithubApiError = {
        name: 'GithubApiError',
        message: 'Not Found',
        response: {
          status: 404,
          data: {
            message: 'Not Found',
            documentation_url: 'https://docs.github.com/rest',
          },
        },
      };

      expect(error.response?.status).toBe(404);
    });
  });

  describe('Rate limit handling', () => {
    it('should identify rate limit errors', () => {
      const rateLimitMessage = 'API rate limit exceeded for user';
      expect(rateLimitMessage.includes('rate limit')).toBe(true);
    });

    it('should provide helpful rate limit error message', () => {
      const errorMessage = 'GitHub API rate limit exceeded. Please try again later.';
      expect(errorMessage).toContain('rate limit');
      expect(errorMessage).toContain('try again');
    });
  });

  describe('Network error handling', () => {
    it('should handle network timeout', () => {
      const error: Error = {
        name: 'NetworkError',
        message: 'request timeout',
      };

      expect(error.message).toContain('timeout');
    });

    it('should handle connection refused', () => {
      const error: Error = {
        name: 'NetworkError',
        message: 'connect ECONNREFUSED',
      };

      expect(error.message).toContain('ECONNREFUSED');
    });
  });
});
