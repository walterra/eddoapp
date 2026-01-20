/**
 * pi-coding-agent skill/extension detection and conflict analysis
 */

import fs from 'fs';
import path from 'path';

/** Installation status for a skill or extension */
export type InstallStatus =
  | 'not_installed'
  | 'linked_correct'
  | 'linked_different'
  | 'exists_directory';

export interface SkillInfo {
  name: string;
  status: InstallStatus;
  sourcePath: string;
  targetPath: string;
  /** For linked_different: the actual symlink target */
  existingTarget?: string;
  /** Skill name from SKILL.md frontmatter (if available) */
  skillName?: string;
}

export interface ConflictInfo {
  type: 'symlink_different' | 'directory_exists' | 'name_clash';
  skillName: string;
  targetPath: string;
  details: string;
}

export interface EddoSkillsStatus {
  skills: SkillInfo[];
  extensions: SkillInfo[];
  conflicts: ConflictInfo[];
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
 * Parse skill name from SKILL.md YAML frontmatter
 */
export function parseSkillName(skillPath: string): string | undefined {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return undefined;
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    return nameMatch ? nameMatch[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve symlink target to actual path
 */
function resolveSymlinkTarget(skillPath: string): string | null {
  try {
    if (fs.lstatSync(skillPath).isSymbolicLink()) {
      return fs.realpathSync(skillPath);
    }
    return skillPath;
  } catch {
    return null;
  }
}

/**
 * Get all installed skill names from the pi skills directory
 * @returns Map of skill name to directory path
 */
export function getInstalledSkillNames(): Map<string, string> {
  const skillsDir = getPiSkillsDir();
  const nameToPath = new Map<string, string>();

  if (!fs.existsSync(skillsDir)) {
    return nameToPath;
  }

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

      const skillPath = path.join(skillsDir, entry.name);
      const actualPath = resolveSymlinkTarget(skillPath);
      if (!actualPath) continue;

      const skillName = parseSkillName(actualPath);
      if (skillName) {
        nameToPath.set(skillName, skillPath);
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return nameToPath;
}

/**
 * Determine installation status of a skill/extension at target path
 */
export function getInstallStatus(
  sourcePath: string,
  targetPath: string,
): { status: InstallStatus; existingTarget?: string } {
  if (!fs.existsSync(targetPath)) {
    return { status: 'not_installed' };
  }

  try {
    const stats = fs.lstatSync(targetPath);

    if (stats.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(targetPath);
      const resolvedTarget = path.resolve(path.dirname(targetPath), linkTarget);
      const resolvedSource = path.resolve(sourcePath);

      if (resolvedTarget === resolvedSource) {
        return { status: 'linked_correct' };
      }
      return { status: 'linked_different', existingTarget: resolvedTarget };
    }

    if (stats.isDirectory()) {
      return { status: 'exists_directory' };
    }
  } catch {
    return { status: 'not_installed' };
  }

  return { status: 'not_installed' };
}

/**
 * Build SkillInfo for a single skill/extension directory
 */
function buildSkillInfo(
  dirName: string,
  sourcePath: string,
  targetPath: string,
  parseSkillMd: boolean,
): SkillInfo {
  const { status, existingTarget } = getInstallStatus(sourcePath, targetPath);
  const skillName = parseSkillMd ? parseSkillName(sourcePath) : undefined;

  return { name: dirName, status, sourcePath, targetPath, existingTarget, skillName };
}

/**
 * Check for conflicts in a skill/extension
 */
function detectConflicts(
  info: SkillInfo,
  installedSkillNames: Map<string, string>,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  if (info.status === 'linked_different') {
    conflicts.push({
      type: 'symlink_different',
      skillName: info.name,
      targetPath: info.targetPath,
      details: `Symlink exists but points to different source: ${info.existingTarget}`,
    });
  } else if (info.status === 'exists_directory') {
    conflicts.push({
      type: 'directory_exists',
      skillName: info.name,
      targetPath: info.targetPath,
      details: `Directory exists (not a symlink). May be a different installation.`,
    });
  }

  // Check for name clash with different directory
  if (info.skillName && info.status === 'not_installed') {
    const existingPath = installedSkillNames.get(info.skillName);
    if (existingPath && existingPath !== info.targetPath) {
      conflicts.push({
        type: 'name_clash',
        skillName: info.name,
        targetPath: info.targetPath,
        details: `Skill name "${info.skillName}" already used by: ${existingPath}`,
      });
    }
  }

  return conflicts;
}

/**
 * Scan a directory for skills or extensions
 */
function scanSourceDirectory(
  sourceDir: string,
  targetDir: string,
  parseSkillMd: boolean,
  installedSkillNames: Map<string, string>,
): { items: SkillInfo[]; conflicts: ConflictInfo[] } {
  const items: SkillInfo[] = [];
  const conflicts: ConflictInfo[] = [];

  if (!fs.existsSync(sourceDir)) {
    return { items, conflicts };
  }

  const dirs = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const sourcePath = path.join(sourceDir, dir.name);
    const targetPath = path.join(targetDir, dir.name);
    const info = buildSkillInfo(dir.name, sourcePath, targetPath, parseSkillMd);

    items.push(info);
    conflicts.push(...detectConflicts(info, installedSkillNames));
  }

  return { items, conflicts };
}

/**
 * Check which eddo skills/extensions are already installed and detect conflicts
 */
export function checkEddoSkillsInstalled(rootDir: string): EddoSkillsStatus {
  const skillsDir = getPiSkillsDir();
  const extensionsDir = getPiExtensionsDir();
  const eddoSkillsSource = path.join(rootDir, 'packages', 'chat-agent', 'skills');
  const eddoExtensionsSource = path.join(rootDir, 'packages', 'chat-agent', 'extensions');

  const installedSkillNames = getInstalledSkillNames();

  const skillResult = scanSourceDirectory(eddoSkillsSource, skillsDir, true, installedSkillNames);
  const extResult = scanSourceDirectory(eddoExtensionsSource, extensionsDir, false, new Map());

  return {
    skills: skillResult.items,
    extensions: extResult.items,
    conflicts: [...skillResult.conflicts, ...extResult.conflicts],
  };
}
