import fs from 'fs';
import os from 'os';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConflictInfo } from './pi-skills-detection.js';
import { displayConflicts, installEddoSkillsAndExtensions } from './pi-skills-install.js';

describe('pi-skills-install', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-skills-install-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('displayConflicts', () => {
    it('returns false when no conflicts', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = displayConflicts([]);
      expect(result).toBe(false);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns true and displays conflicts when present', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const conflicts: ConflictInfo[] = [
        {
          type: 'symlink_different',
          skillName: 'test-skill',
          targetPath: '/path/to/target',
          details: 'Points to different source',
        },
      ];

      const result = displayConflicts(conflicts);
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Conflicts detected');
      expect(allOutput).toContain('test-skill');

      consoleSpy.mockRestore();
    });

    it('shows different icon for name_clash conflicts', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const conflicts: ConflictInfo[] = [
        {
          type: 'name_clash',
          skillName: 'clashing-skill',
          targetPath: '/path/to/target',
          details: 'Name already used',
        },
      ];

      displayConflicts(conflicts);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('🔀');

      consoleSpy.mockRestore();
    });
  });

  describe('installEddoSkillsAndExtensions', () => {
    it('creates symlinks for not_installed skills', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo skill source
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'test-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.writeFileSync(path.join(eddoSkillsDir, 'SKILL.md'), '---\nname: test-skill\n---\n');

      const result = installEddoSkillsAndExtensions(tempDir);

      expect(result).toBe(true);

      // Verify symlink was created
      const targetPath = path.join(tempDir, '.pi', 'agent', 'skills', 'test-skill');
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(targetPath)).toBe(eddoSkillsDir);

      consoleSpy.mockRestore();
    });

    it('skips already correctly linked skills', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo skill source
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'test-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });

      // Create correct symlink
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      fs.mkdirSync(piSkillsDir, { recursive: true });
      fs.symlinkSync(eddoSkillsDir, path.join(piSkillsDir, 'test-skill'), 'dir');

      const result = installEddoSkillsAndExtensions(tempDir);

      expect(result).toBe(true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('already linked correctly');

      consoleSpy.mockRestore();
    });

    it('skips conflicting skills and returns false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo skill source
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'test-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });

      // Create conflicting directory (not a symlink)
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      fs.mkdirSync(path.join(piSkillsDir, 'test-skill'), { recursive: true });

      const result = installEddoSkillsAndExtensions(tempDir);

      expect(result).toBe(false); // Has conflicts

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Skipped');
      expect(allOutput).toContain('conflict');

      consoleSpy.mockRestore();
    });

    it('replaces conflicts when force=true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo skill source
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'test-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });

      // Create conflicting directory (not a symlink)
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const targetPath = path.join(piSkillsDir, 'test-skill');
      fs.mkdirSync(targetPath, { recursive: true });
      fs.writeFileSync(path.join(targetPath, 'old-file.txt'), 'old content');

      const result = installEddoSkillsAndExtensions(tempDir, true);

      expect(result).toBe(true);

      // Verify old directory was replaced with symlink
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(targetPath)).toBe(eddoSkillsDir);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Replaced');

      consoleSpy.mockRestore();
    });

    it('creates pi directories if they do not exist', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo skill source
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'test-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });

      // Verify directories don't exist yet
      expect(fs.existsSync(path.join(tempDir, '.pi', 'agent', 'skills'))).toBe(false);

      installEddoSkillsAndExtensions(tempDir);

      // Verify directories were created
      expect(fs.existsSync(path.join(tempDir, '.pi', 'agent', 'skills'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.pi', 'agent', 'extensions'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('handles extensions similarly to skills', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create eddo extension source
      const eddoExtDir = path.join(tempDir, 'packages', 'chat-agent', 'extensions', 'test-ext');
      fs.mkdirSync(eddoExtDir, { recursive: true });

      const result = installEddoSkillsAndExtensions(tempDir);

      expect(result).toBe(true);

      // Verify symlink was created
      const targetPath = path.join(tempDir, '.pi', 'agent', 'extensions', 'test-ext');
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
