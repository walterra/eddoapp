import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  checkEddoSkillsInstalled,
  getInstallStatus,
  getInstalledSkillNames,
  getPiExtensionsDir,
  getPiSkillsDir,
  parseSkillName,
} from './pi-skills-detection.js';

describe('pi-skills-detection', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-skills-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getPiSkillsDir', () => {
    it('returns correct path', () => {
      const result = getPiSkillsDir();
      expect(result).toBe(path.join(tempDir, '.pi', 'agent', 'skills'));
    });
  });

  describe('getPiExtensionsDir', () => {
    it('returns correct path', () => {
      const result = getPiExtensionsDir();
      expect(result).toBe(path.join(tempDir, '.pi', 'agent', 'extensions'));
    });
  });

  describe('parseSkillName', () => {
    it('parses skill name from SKILL.md frontmatter', () => {
      const skillDir = path.join(tempDir, 'test-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
name: my-test-skill
description: A test skill
---

# My Test Skill
Content here
`,
      );

      const result = parseSkillName(skillDir);
      expect(result).toBe('my-test-skill');
    });

    it('returns undefined when SKILL.md does not exist', () => {
      const skillDir = path.join(tempDir, 'no-skill-md');
      fs.mkdirSync(skillDir, { recursive: true });

      const result = parseSkillName(skillDir);
      expect(result).toBeUndefined();
    });

    it('returns undefined when frontmatter is missing', () => {
      const skillDir = path.join(tempDir, 'no-frontmatter');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Just a heading\n\nNo frontmatter here');

      const result = parseSkillName(skillDir);
      expect(result).toBeUndefined();
    });

    it('returns undefined when name field is missing in frontmatter', () => {
      const skillDir = path.join(tempDir, 'no-name-field');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
description: No name field
---

# Skill
`,
      );

      const result = parseSkillName(skillDir);
      expect(result).toBeUndefined();
    });
  });

  describe('getInstallStatus', () => {
    it('returns not_installed when target does not exist', () => {
      const result = getInstallStatus('/some/source', path.join(tempDir, 'nonexistent'));
      expect(result.status).toBe('not_installed');
    });

    it('returns linked_correct when symlink points to source', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.symlinkSync(sourceDir, targetDir, 'dir');

      const result = getInstallStatus(sourceDir, targetDir);
      expect(result.status).toBe('linked_correct');
    });

    it('returns linked_different when symlink points elsewhere', () => {
      const sourceDir = path.join(tempDir, 'source');
      const otherDir = path.join(tempDir, 'other');
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(otherDir, { recursive: true });
      fs.symlinkSync(otherDir, targetDir, 'dir');

      const result = getInstallStatus(sourceDir, targetDir);
      expect(result.status).toBe('linked_different');
      expect(result.existingTarget).toBe(otherDir);
    });

    it('returns exists_directory when target is a real directory', () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(targetDir, { recursive: true });

      const result = getInstallStatus(sourceDir, targetDir);
      expect(result.status).toBe('exists_directory');
    });
  });

  describe('getInstalledSkillNames', () => {
    it('returns empty map when skills directory does not exist', () => {
      const result = getInstalledSkillNames();
      expect(result.size).toBe(0);
    });

    it('returns map of skill names from installed skills', () => {
      const skillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const skill1Dir = path.join(skillsDir, 'skill-one');
      const skill2Dir = path.join(skillsDir, 'skill-two');

      fs.mkdirSync(skill1Dir, { recursive: true });
      fs.mkdirSync(skill2Dir, { recursive: true });

      fs.writeFileSync(
        path.join(skill1Dir, 'SKILL.md'),
        `---
name: first-skill
---
`,
      );
      fs.writeFileSync(
        path.join(skill2Dir, 'SKILL.md'),
        `---
name: second-skill
---
`,
      );

      const result = getInstalledSkillNames();
      expect(result.size).toBe(2);
      expect(result.get('first-skill')).toBe(skill1Dir);
      expect(result.get('second-skill')).toBe(skill2Dir);
    });

    it('follows symlinks to read SKILL.md', () => {
      const skillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const sourceDir = path.join(tempDir, 'skill-source');
      const symlinkPath = path.join(skillsDir, 'linked-skill');

      fs.mkdirSync(skillsDir, { recursive: true });
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, 'SKILL.md'),
        `---
name: linked-skill-name
---
`,
      );
      fs.symlinkSync(sourceDir, symlinkPath, 'dir');

      const result = getInstalledSkillNames();
      expect(result.get('linked-skill-name')).toBe(symlinkPath);
    });
  });

  describe('checkEddoSkillsInstalled', () => {
    it('returns empty arrays when source directories do not exist', () => {
      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(0);
      expect(result.extensions).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('detects not_installed skills', () => {
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'my-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(eddoSkillsDir, 'SKILL.md'),
        `---
name: my-skill
---
`,
      );

      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('my-skill');
      expect(result.skills[0].status).toBe('not_installed');
      expect(result.conflicts).toHaveLength(0);
    });

    it('detects linked_correct skills', () => {
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'my-skill');
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const targetPath = path.join(piSkillsDir, 'my-skill');

      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.mkdirSync(piSkillsDir, { recursive: true });
      fs.symlinkSync(eddoSkillsDir, targetPath, 'dir');

      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].status).toBe('linked_correct');
      expect(result.conflicts).toHaveLength(0);
    });

    it('detects linked_different conflict', () => {
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'my-skill');
      const otherSource = path.join(tempDir, 'other-source');
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const targetPath = path.join(piSkillsDir, 'my-skill');

      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.mkdirSync(otherSource, { recursive: true });
      fs.mkdirSync(piSkillsDir, { recursive: true });
      fs.symlinkSync(otherSource, targetPath, 'dir');

      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].status).toBe('linked_different');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('symlink_different');
    });

    it('detects exists_directory conflict', () => {
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'my-skill');
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const targetPath = path.join(piSkillsDir, 'my-skill');

      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.mkdirSync(targetPath, { recursive: true });

      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].status).toBe('exists_directory');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('directory_exists');
    });

    it('detects name_clash conflict', () => {
      // Create eddo skill with name "shared-name"
      const eddoSkillsDir = path.join(tempDir, 'packages', 'chat-agent', 'skills', 'eddo-skill');
      fs.mkdirSync(eddoSkillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(eddoSkillsDir, 'SKILL.md'),
        `---
name: shared-name
---
`,
      );

      // Create existing skill with same "shared-name" but different directory
      const piSkillsDir = path.join(tempDir, '.pi', 'agent', 'skills');
      const existingSkillDir = path.join(piSkillsDir, 'other-skill');
      fs.mkdirSync(existingSkillDir, { recursive: true });
      fs.writeFileSync(
        path.join(existingSkillDir, 'SKILL.md'),
        `---
name: shared-name
---
`,
      );

      const result = checkEddoSkillsInstalled(tempDir);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].status).toBe('not_installed');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('name_clash');
      expect(result.conflicts[0].details).toContain('shared-name');
    });
  });
});
