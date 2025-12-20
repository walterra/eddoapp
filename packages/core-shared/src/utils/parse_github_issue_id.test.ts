import { describe, expect, it } from 'vitest';

import { formatGitHubIssueId, isGitHubIssueId, parseGitHubIssueId } from './parse_github_issue_id';

describe('parseGitHubIssueId', () => {
  it('should parse valid GitHub issue ID', () => {
    const result = parseGitHubIssueId('github:walterra/eddoapp/issues/1234');

    expect(result).toEqual({
      owner: 'walterra',
      repo: 'eddoapp',
      number: 1234,
    });
  });

  it('should parse issue with different owner and repo names', () => {
    const result = parseGitHubIssueId('github:facebook/react/issues/999');

    expect(result).toEqual({
      owner: 'facebook',
      repo: 'react',
      number: 999,
    });
  });

  it('should return null for invalid prefix', () => {
    expect(parseGitHubIssueId('gitlab:owner/repo/issues/123')).toBeNull();
    expect(parseGitHubIssueId('owner/repo/issues/123')).toBeNull();
  });

  it('should return null for missing components', () => {
    expect(parseGitHubIssueId('github:owner/repo')).toBeNull();
    expect(parseGitHubIssueId('github:owner')).toBeNull();
    expect(parseGitHubIssueId('github:')).toBeNull();
  });

  it('should return null for wrong path structure', () => {
    expect(parseGitHubIssueId('github:owner/repo/pulls/123')).toBeNull();
    expect(parseGitHubIssueId('github:owner/repo/123')).toBeNull();
  });

  it('should return null for invalid issue number', () => {
    expect(parseGitHubIssueId('github:owner/repo/issues/abc')).toBeNull();
    expect(parseGitHubIssueId('github:owner/repo/issues/0')).toBeNull();
    expect(parseGitHubIssueId('github:owner/repo/issues/-1')).toBeNull();
    expect(parseGitHubIssueId('github:owner/repo/issues/')).toBeNull();
  });

  it('should return null for empty or invalid input', () => {
    expect(parseGitHubIssueId('')).toBeNull();
    expect(parseGitHubIssueId(null as unknown as string)).toBeNull();
    expect(parseGitHubIssueId(undefined as unknown as string)).toBeNull();
    expect(parseGitHubIssueId(123 as unknown as string)).toBeNull();
  });

  it('should return null for empty owner or repo', () => {
    expect(parseGitHubIssueId('github:/repo/issues/123')).toBeNull();
    expect(parseGitHubIssueId('github:owner//issues/123')).toBeNull();
  });
});

describe('formatGitHubIssueId', () => {
  it('should format valid GitHub issue components', () => {
    const result = formatGitHubIssueId('walterra', 'eddoapp', 1234);
    expect(result).toBe('github:walterra/eddoapp/issues/1234');
  });

  it('should format with different values', () => {
    expect(formatGitHubIssueId('facebook', 'react', 999)).toBe('github:facebook/react/issues/999');
  });

  it('should throw for invalid owner', () => {
    expect(() => formatGitHubIssueId('', 'repo', 123)).toThrow('Invalid GitHub issue components');
  });

  it('should throw for invalid repo', () => {
    expect(() => formatGitHubIssueId('owner', '', 123)).toThrow('Invalid GitHub issue components');
  });

  it('should throw for invalid issue number', () => {
    expect(() => formatGitHubIssueId('owner', 'repo', 0)).toThrow(
      'Invalid GitHub issue components',
    );
    expect(() => formatGitHubIssueId('owner', 'repo', -1)).toThrow(
      'Invalid GitHub issue components',
    );
  });
});

describe('isGitHubIssueId', () => {
  it('should return true for valid GitHub issue ID', () => {
    expect(isGitHubIssueId('github:walterra/eddoapp/issues/1234')).toBe(true);
    expect(isGitHubIssueId('github:facebook/react/issues/999')).toBe(true);
  });

  it('should return false for invalid GitHub issue ID', () => {
    expect(isGitHubIssueId('gitlab:owner/repo/issues/123')).toBe(false);
    expect(isGitHubIssueId('github:owner/repo')).toBe(false);
    expect(isGitHubIssueId('not-a-github-id')).toBe(false);
  });

  it('should return false for null, undefined, or empty string', () => {
    expect(isGitHubIssueId(null)).toBe(false);
    expect(isGitHubIssueId(undefined)).toBe(false);
    expect(isGitHubIssueId('')).toBe(false);
  });
});
