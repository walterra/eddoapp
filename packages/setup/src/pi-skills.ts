/**
 * pi-coding-agent skills and extensions integration
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface SkillInfo {
  name: string;
  installed: boolean;
  sourcePath: string;
  targetPath: string;
}

export interface EddoSkillsStatus {
  skills: SkillInfo[];
  extensions: SkillInfo[];
}

/**
 * Check if pi-coding-agent is installed globally via npm
 */
export function isPiCodingAgentInstalled(): { installed: boolean; version?: string } {
  try {
    const result = execSync('npm list -g @mariozechner/pi-coding-agent --json 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result);
    const deps = parsed.dependencies?.['@mariozechner/pi-coding-agent'];
    if (deps?.version) {
      return { installed: true, version: deps.version };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

/**
 * Get the pi skills directory path
 */
export function getPiSkillsDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.pi', 'agent', 'skills');
}

/**
 * Get the pi extensions directory path
 */
export function getPiExtensionsDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.pi', 'agent', 'extensions');
}

/**
 * Check which eddo skills/extensions are already installed
 */
export function checkEddoSkillsInstalled(rootDir: string): EddoSkillsStatus {
  const skillsDir = getPiSkillsDir();
  const extensionsDir = getPiExtensionsDir();

  const eddoSkillsSource = path.join(rootDir, 'packages', 'chat-agent', 'skills');
  const eddoExtensionsSource = path.join(rootDir, 'packages', 'chat-agent', 'extensions');

  const skills: SkillInfo[] = [];
  const extensions: SkillInfo[] = [];

  if (fs.existsSync(eddoSkillsSource)) {
    const skillDirs = fs.readdirSync(eddoSkillsSource, { withFileTypes: true });
    for (const dir of skillDirs) {
      if (dir.isDirectory()) {
        const sourcePath = path.join(eddoSkillsSource, dir.name);
        const targetPath = path.join(skillsDir, dir.name);
        const installed = fs.existsSync(targetPath);
        skills.push({ name: dir.name, installed, sourcePath, targetPath });
      }
    }
  }

  if (fs.existsSync(eddoExtensionsSource)) {
    const extDirs = fs.readdirSync(eddoExtensionsSource, { withFileTypes: true });
    for (const dir of extDirs) {
      if (dir.isDirectory()) {
        const sourcePath = path.join(eddoExtensionsSource, dir.name);
        const targetPath = path.join(extensionsDir, dir.name);
        const installed = fs.existsSync(targetPath);
        extensions.push({ name: dir.name, installed, sourcePath, targetPath });
      }
    }
  }

  return { skills, extensions };
}

/**
 * Install eddo skills and extensions by creating symlinks
 */
export function installEddoSkillsAndExtensions(rootDir: string): boolean {
  const { skills, extensions } = checkEddoSkillsInstalled(rootDir);
  const skillsDir = getPiSkillsDir();
  const extensionsDir = getPiExtensionsDir();

  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
    console.log(chalk.gray(`  Created ${skillsDir}`));
  }
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
    console.log(chalk.gray(`  Created ${extensionsDir}`));
  }

  let allSuccess = true;

  for (const skill of skills) {
    if (skill.installed) {
      console.log(chalk.gray(`  ○ Skill ${skill.name} already linked`));
      continue;
    }
    try {
      fs.symlinkSync(skill.sourcePath, skill.targetPath, 'dir');
      console.log(chalk.green(`  ✓ Linked skill: ${skill.name}`));
    } catch (err) {
      console.log(chalk.red(`  ✗ Failed to link skill ${skill.name}: ${(err as Error).message}`));
      allSuccess = false;
    }
  }

  for (const ext of extensions) {
    if (ext.installed) {
      console.log(chalk.gray(`  ○ Extension ${ext.name} already linked`));
      continue;
    }
    try {
      fs.symlinkSync(ext.sourcePath, ext.targetPath, 'dir');
      console.log(chalk.green(`  ✓ Linked extension: ${ext.name}`));
    } catch (err) {
      console.log(chalk.red(`  ✗ Failed to link extension ${ext.name}: ${(err as Error).message}`));
      allSuccess = false;
    }
  }

  return allSuccess;
}
