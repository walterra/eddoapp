import { describe, expect, it } from 'vitest';

import {
  execGit,
  getCurrentBranch,
  getHeadCommit,
  isGitAvailable,
  isGitRepo,
} from './git-executor';

describe('git-executor', () => {
  describe('isGitAvailable', () => {
    it('should return true when git is available', async () => {
      const result = await isGitAvailable();
      expect(result).toBe(true);
    });
  });

  describe('execGit', () => {
    it('should execute a simple git command', async () => {
      const result = await execGit('.', ['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/git version/);
    });

    it('should return non-zero exit code for invalid commands', async () => {
      const result = await execGit('.', ['invalid-command-xyz']);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('isGitRepo', () => {
    it('should return true for a git repository', async () => {
      const result = await isGitRepo('.');
      expect(result).toBe(true);
    });

    it('should return false for a non-git directory', async () => {
      const result = await isGitRepo('/tmp');
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await getCurrentBranch('.');
      expect(branch).toBeTruthy();
      expect(typeof branch).toBe('string');
    });
  });

  describe('getHeadCommit', () => {
    it('should return a commit hash', async () => {
      const commit = await getHeadCommit('.');
      expect(commit).toBeTruthy();
      expect(commit).toMatch(/^[a-f0-9]{40}$/);
    });
  });
});
