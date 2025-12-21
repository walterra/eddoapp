import { describe, expect, it, vi } from 'vitest';

import { createGithubClient, generateExternalId, mapIssueToTodo } from './client';
import type { GithubIssue } from './types';

describe('GitHub Client', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockIssue: GithubIssue = {
    id: 123456,
    number: 42,
    title: 'Fix login bug',
    body: 'Users cannot login with special characters in password',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/42',
    created_at: '2025-12-20T10:00:00Z',
    updated_at: '2025-12-21T09:00:00Z',
    closed_at: null,
    labels: [
      { name: 'bug', color: 'ff0000' },
      { name: 'priority:high', color: '00ff00' },
    ],
    repository: {
      full_name: 'owner/repo',
      owner: { login: 'owner' },
      name: 'repo',
    },
    user: {
      login: 'testuser',
    },
  };

  describe('generateExternalId', () => {
    it('should create consistent external ID format', () => {
      const externalId = generateExternalId(mockIssue);
      expect(externalId).toBe('github:owner/repo/issues/42');
    });

    it('should handle different repository names', () => {
      const issue: GithubIssue = {
        ...mockIssue,
        number: 999,
        repository: {
          full_name: 'user/another-repo',
          owner: { login: 'user' },
          name: 'another-repo',
        },
      };

      const externalId = generateExternalId(issue);
      expect(externalId).toBe('github:user/another-repo/issues/999');
    });
  });

  describe('mapIssueToTodo', () => {
    it('should map open GitHub issue to TodoAlpha3', () => {
      const todo = mapIssueToTodo(mockIssue, 'work', ['github']);

      expect(todo.title).toBe('Fix login bug');
      expect(todo.description).toBe('Users cannot login with special characters in password');
      expect(todo.context).toBe('work');
      expect(todo.tags).toEqual(['github', 'bug', 'priority:high']);
      expect(todo.externalId).toBe('github:owner/repo/issues/42');
      expect(todo.link).toBe('https://github.com/owner/repo/issues/42');
      expect(todo.completed).toBe(null);
      expect(todo.version).toBe('alpha3');
      expect(todo.active).toEqual({});
      expect(todo.due).toBe('');
      expect(todo.repeat).toBe(null);
    });

    it('should map closed GitHub issue to completed todo', () => {
      const closedIssue: GithubIssue = {
        ...mockIssue,
        state: 'closed',
        closed_at: '2025-12-21T12:00:00Z',
      };

      const todo = mapIssueToTodo(closedIssue, 'work', ['github']);

      expect(todo.completed).toBe('2025-12-21T12:00:00Z');
    });

    it('should handle issue with no body', () => {
      const noBodyIssue: GithubIssue = {
        ...mockIssue,
        body: null,
      };

      const todo = mapIssueToTodo(noBodyIssue, 'private', ['github', 'external']);

      expect(todo.description).toBe('');
      expect(todo.context).toBe('private');
      expect(todo.tags).toEqual(['github', 'external', 'bug', 'priority:high']);
    });

    it('should combine custom tags with issue labels', () => {
      const todo = mapIssueToTodo(mockIssue, 'work', ['github', 'sync', 'external']);

      expect(todo.tags).toEqual(['github', 'sync', 'external', 'bug', 'priority:high']);
    });

    it('should handle issue with no labels', () => {
      const noLabelsIssue: GithubIssue = {
        ...mockIssue,
        labels: [],
      };

      const todo = mapIssueToTodo(noLabelsIssue, 'work', ['github']);

      expect(todo.tags).toEqual(['github']);
    });
  });

  describe('createGithubClient', () => {
    it('should create client with valid token', () => {
      const client = createGithubClient({ token: 'ghp_test_token' }, mockLogger);

      expect(client).toBeDefined();
      expect(client.fetchUserIssues).toBeDefined();
      expect(client.mapIssueToTodo).toBeDefined();
      expect(client.generateExternalId).toBeDefined();
    });

    it('should expose mapping functions', () => {
      const client = createGithubClient({ token: 'ghp_test_token' }, mockLogger);

      const externalId = client.generateExternalId(mockIssue);
      expect(externalId).toBe('github:owner/repo/issues/42');

      const todo = client.mapIssueToTodo(mockIssue, 'work', ['github']);
      expect(todo.title).toBe('Fix login bug');
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error for invalid token', async () => {
      const client = createGithubClient({ token: 'invalid_token' }, mockLogger);

      await expect(client.fetchUserIssues()).rejects.toThrow();
    });
  });
});
