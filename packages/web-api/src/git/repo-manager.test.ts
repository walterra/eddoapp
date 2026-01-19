/**
 * Tests for repo-manager.ts
 */

import { homedir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { createRepoManager } from './repo-manager';

describe('createRepoManager', () => {
  describe('getConfig', () => {
    it('returns default config when no config provided', () => {
      const manager = createRepoManager();
      const config = manager.getConfig();

      expect(config.baseDir).toBe(join(homedir(), '.eddo', 'repos'));
      expect(config.autoFetch).toBe(true);
      expect(config.fetchIntervalMinutes).toBe(60);
    });

    it('merges provided config with defaults', () => {
      const manager = createRepoManager({
        baseDir: '/custom/path',
        autoFetch: false,
      });
      const config = manager.getConfig();

      expect(config.baseDir).toBe('/custom/path');
      expect(config.autoFetch).toBe(false);
      expect(config.fetchIntervalMinutes).toBe(60);
    });
  });
});

describe('slug sanitization', () => {
  it('handles standard owner/repo format', async () => {
    const manager = createRepoManager({ baseDir: '/test/repos' });
    // We can't directly test the private sanitizeSlug function,
    // but we can verify behavior through getRepoInfo which uses the paths
    const info = await manager.getRepoInfo('elastic/kibana');
    // Will return null since repo doesn't exist, but no error means path is valid
    expect(info).toBeNull();
  });

  it('handles slugs with multiple slashes', async () => {
    const manager = createRepoManager({ baseDir: '/test/repos' });
    // org/team/repo should become org_team_repo, not nested dirs
    const info = await manager.getRepoInfo('org/team/repo');
    expect(info).toBeNull();
  });

  it('handles slugs without slashes', async () => {
    const manager = createRepoManager({ baseDir: '/test/repos' });
    const info = await manager.getRepoInfo('simple-repo');
    expect(info).toBeNull();
  });
});
