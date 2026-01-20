/**
 * pi-coding-agent skill/extension installation
 */

import chalk from 'chalk';
import fs from 'fs';

import {
  checkEddoSkillsInstalled,
  getPiExtensionsDir,
  getPiSkillsDir,
  type ConflictInfo,
  type SkillInfo,
} from './pi-skills-detection.js';

/**
 * Display conflicts to user before installation
 * @returns true if there are conflicts
 */
export function displayConflicts(conflicts: readonly ConflictInfo[]): boolean {
  if (conflicts.length === 0) {
    return false;
  }

  console.log(chalk.yellow('\n⚠️  Conflicts detected:\n'));

  for (const conflict of conflicts) {
    const icon = conflict.type === 'name_clash' ? '🔀' : '⚠️';
    console.log(chalk.yellow(`  ${icon} ${conflict.skillName}`));
    console.log(chalk.gray(`     ${conflict.details}`));
    console.log(chalk.gray(`     Target: ${conflict.targetPath}\n`));
  }

  console.log(chalk.yellow('  These items will be skipped to avoid duplicates.'));
  console.log(chalk.gray('  To reinstall, manually remove the existing items first.\n'));

  return true;
}

/**
 * Ensure directory exists, create if needed
 */
function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(chalk.gray(`  Created ${dirPath}`));
  }
}

/**
 * Create a symlink for a skill/extension
 */
function createSymlink(
  item: SkillInfo,
  itemType: 'skill' | 'extension',
): { success: boolean; installed: boolean } {
  try {
    fs.symlinkSync(item.sourcePath, item.targetPath, 'dir');
    console.log(chalk.green(`  ✓ Linked ${itemType}: ${item.name}`));
    return { success: true, installed: true };
  } catch (err) {
    console.log(
      chalk.red(`  ✗ Failed to link ${itemType} ${item.name}: ${(err as Error).message}`),
    );
    return { success: false, installed: false };
  }
}

/**
 * Replace existing skill/extension (force mode)
 */
function replaceExisting(
  item: SkillInfo,
  itemType: 'skill' | 'extension',
): { success: boolean; installed: boolean } {
  try {
    if (item.status === 'linked_different') {
      fs.unlinkSync(item.targetPath);
    } else {
      fs.rmSync(item.targetPath, { recursive: true });
    }
    fs.symlinkSync(item.sourcePath, item.targetPath, 'dir');
    console.log(chalk.green(`  ✓ Replaced ${itemType}: ${item.name}`));
    return { success: true, installed: true };
  } catch (err) {
    console.log(
      chalk.red(`  ✗ Failed to replace ${itemType} ${item.name}: ${(err as Error).message}`),
    );
    return { success: false, installed: false };
  }
}

/**
 * Install a single skill or extension by creating a symlink
 */
function installItem(
  item: SkillInfo,
  itemType: 'skill' | 'extension',
  conflictNames: Set<string>,
  force: boolean,
): { success: boolean; installed: boolean } {
  // Skip if there's a conflict (unless force)
  if (conflictNames.has(item.name) && !force) {
    console.log(chalk.yellow(`  ⊘ Skipped ${itemType} ${item.name} (conflict)`));
    return { success: true, installed: false };
  }

  if (item.status === 'linked_correct') {
    console.log(chalk.gray(`  ○ ${itemType} ${item.name} already linked correctly`));
    return { success: true, installed: false };
  }

  if (item.status === 'not_installed') {
    return createSymlink(item, itemType);
  }

  // Handle force mode for conflicts
  if (force && (item.status === 'linked_different' || item.status === 'exists_directory')) {
    return replaceExisting(item, itemType);
  }

  return { success: true, installed: false };
}

/**
 * Display installation summary
 */
function displayInstallSummary(installedCount: number, skippedCount: number): void {
  if (installedCount === 0 && skippedCount === 0) return;

  console.log('');
  if (installedCount > 0) {
    console.log(chalk.green(`  ${installedCount} item(s) installed`));
  }
  if (skippedCount > 0) {
    console.log(chalk.yellow(`  ${skippedCount} item(s) skipped due to conflicts`));
  }
}

interface InstallResult {
  allSuccess: boolean;
  installedCount: number;
  skippedCount: number;
}

/**
 * Process installation for a list of items
 */
function processInstallList(
  items: readonly SkillInfo[],
  itemType: 'skill' | 'extension',
  conflictNames: Set<string>,
  force: boolean,
): InstallResult {
  let allSuccess = true;
  let installedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const result = installItem(item, itemType, conflictNames, force);
    if (!result.success) allSuccess = false;
    if (result.installed) installedCount++;
    if (conflictNames.has(item.name) && !force) skippedCount++;
  }

  return { allSuccess, installedCount, skippedCount };
}

/**
 * Install eddo skills and extensions by creating symlinks
 * @param rootDir - Root directory of the eddo project
 * @param force - If true, overwrite conflicts (removes existing and creates new symlink)
 */
export function installEddoSkillsAndExtensions(rootDir: string, force = false): boolean {
  const { skills, extensions, conflicts } = checkEddoSkillsInstalled(rootDir);

  // In non-force mode, display conflicts (they will be skipped)
  // In force mode, conflicts are handled by replacement, so don't penalize the result
  const hasConflicts = !force && displayConflicts(conflicts);
  const conflictNames = new Set(conflicts.map((c) => c.skillName));

  ensureDirectory(getPiSkillsDir());
  ensureDirectory(getPiExtensionsDir());

  const skillResult = processInstallList(skills, 'skill', conflictNames, force);
  const extResult = processInstallList(extensions, 'extension', conflictNames, force);

  const totalInstalled = skillResult.installedCount + extResult.installedCount;
  const totalSkipped = skillResult.skippedCount + extResult.skippedCount;

  displayInstallSummary(totalInstalled, totalSkipped);

  return skillResult.allSuccess && extResult.allSuccess && !hasConflicts;
}
