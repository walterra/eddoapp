#!/usr/bin/env tsx
/**
 * Backup Retention Policy Manager
 * Manages backup file lifecycle with configurable retention periods
 */
import chalk from 'chalk';
import { Command } from 'commander';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import path from 'path';

import {
  type BackupFileWithDate,
  type RetentionConfig,
  calculateCutoffs,
  categorizeBackups,
  deleteBackupFile,
  enrichBackupFiles,
} from './backup-retention-utils.js';
import { DEFAULT_CONFIG, formatFileSize, getAllBackupFiles } from './backup-utils.js';

dotenvLoad();

export type { RetentionConfig } from './backup-retention-utils.js';

export interface RetentionPolicyConfig extends RetentionConfig {
  backupDir: string;
}

interface RetentionResult {
  kept: BackupFileWithDate[];
  deleted: BackupFileWithDate[];
  errors: Array<{ file: string; error: string }>;
  freedBytes: number;
}

/** Group backups by database */
function groupByDatabase(backups: BackupFileWithDate[]): Map<string, BackupFileWithDate[]> {
  const byDatabase = new Map<string, BackupFileWithDate[]>();
  for (const backup of backups) {
    const existing = byDatabase.get(backup.database) || [];
    existing.push(backup);
    byDatabase.set(backup.database, existing);
  }
  return byDatabase;
}

/** Apply policy to a single database's backups */
function applyPolicyToDatabase(
  dbBackups: BackupFileWithDate[],
  config: RetentionConfig,
  result: RetentionResult,
): void {
  const categorized = categorizeBackups(dbBackups, config);
  result.kept.push(...categorized.daily, ...categorized.weekly, ...categorized.monthly);
  for (const backup of categorized.toDelete) {
    const deleteResult = deleteBackupFile(backup, config.dryRun);
    if (deleteResult.success) {
      result.deleted.push(backup);
      result.freedBytes += backup.size;
    } else if (deleteResult.error)
      result.errors.push({ file: backup.path, error: deleteResult.error });
  }
}

/** Apply retention policy to backup files */
export async function applyRetentionPolicy(
  config: RetentionPolicyConfig,
): Promise<RetentionResult> {
  const result: RetentionResult = { kept: [], deleted: [], errors: [], freedBytes: 0 };
  const allBackups = getAllBackupFiles(config.backupDir);
  if (allBackups.length === 0) return result;

  const backupsWithDates = enrichBackupFiles(allBackups);
  const byDatabase = groupByDatabase(backupsWithDates);
  for (const [, dbBackups] of byDatabase) applyPolicyToDatabase(dbBackups, config, result);
  return result;
}

/** Display deleted backups list */
function displayDeletedList(deleted: BackupFileWithDate[]): void {
  const show = deleted.length <= 10 ? deleted : deleted.slice(0, 5);
  show.forEach((b) =>
    console.log(
      chalk.gray(`   - ${path.basename(b.path)} (${b.date.toISOString().split('T')[0]})`),
    ),
  );
  if (deleted.length > 10) console.log(chalk.gray(`   ... and ${deleted.length - 5} more`));
}

/** Display retention policy summary */
function displaySummary(result: RetentionResult, config: RetentionPolicyConfig): void {
  console.log(chalk.bold('\n📊 Retention Policy Summary'));
  console.log('─'.repeat(50));

  const cutoffs = calculateCutoffs(config);
  const dailyKept = result.kept.filter((b) => b.date >= cutoffs.daily);
  const weeklyKept = result.kept.filter((b) => b.date < cutoffs.daily && b.date >= cutoffs.weekly);
  const monthlyKept = result.kept.filter((b) => b.date < cutoffs.weekly);

  console.log(chalk.green(`\n✅ Kept: ${result.kept.length} backup(s)`));
  console.log(`   Daily (last ${config.dailyRetentionDays} days): ${dailyKept.length}`);
  console.log(`   Weekly (last ${config.weeklyRetentionWeeks} weeks): ${weeklyKept.length}`);
  console.log(`   Monthly (last ${config.monthlyRetentionMonths} months): ${monthlyKept.length}`);

  if (result.deleted.length > 0) {
    const [actionWord, icon, freedWord] = config.dryRun
      ? ['Would delete', '🔍', 'to be freed']
      : ['Deleted', '🗑️ ', 'freed'];
    console.log(chalk.yellow(`\n${icon} ${actionWord}: ${result.deleted.length} backup(s)`));
    console.log(`   Space ${freedWord}: ${formatFileSize(result.freedBytes)}`);
    displayDeletedList(result.deleted);
  }

  if (result.errors.length > 0) {
    console.log(chalk.red(`\n❌ Errors: ${result.errors.length}`));
    result.errors.forEach((err) => console.log(chalk.red(`   - ${err.file}: ${err.error}`)));
  }

  if (config.dryRun) console.log(chalk.yellow('\n⚠️  Dry run mode - no files were deleted'));
  console.log();
}

/** Display verbose backup details */
function displayVerboseDetails(kept: BackupFileWithDate[]): void {
  console.log(chalk.bold('Kept Backups:'));
  const byDatabase = groupByDatabase(kept);
  for (const [database, backups] of byDatabase) {
    console.log(`\n  ${chalk.cyan(database)} (${backups.length} backups):`);
    const sorted = backups.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
    sorted.forEach((b) =>
      console.log(chalk.gray(`    - ${path.basename(b.path)} (${formatFileSize(b.size)})`)),
    );
    if (backups.length > 5) console.log(chalk.gray(`    ... and ${backups.length - 5} more`));
  }
  console.log();
}

interface CliOptions {
  backupDir: string;
  daily: string;
  weekly: string;
  monthly: string;
  dryRun?: boolean;
  verbose?: boolean;
}

/** Run retention policy with CLI options */
async function runRetentionPolicy(options: CliOptions): Promise<void> {
  console.log(chalk.blue('\n📦 Backup Retention Policy Manager\n'));
  const config: RetentionPolicyConfig = {
    backupDir: options.backupDir,
    dailyRetentionDays: parseInt(options.daily, 10),
    weeklyRetentionWeeks: parseInt(options.weekly, 10),
    monthlyRetentionMonths: parseInt(options.monthly, 10),
    dryRun: options.dryRun || false,
  };

  console.log(chalk.bold('Configuration:'));
  console.log(`  Backup Directory: ${chalk.cyan(config.backupDir)}`);
  console.log(`  Daily Retention: ${chalk.cyan(config.dailyRetentionDays)} days`);
  console.log(`  Weekly Retention: ${chalk.cyan(config.weeklyRetentionWeeks)} weeks`);
  console.log(`  Monthly Retention: ${chalk.cyan(config.monthlyRetentionMonths)} months`);
  console.log(`  Mode: ${config.dryRun ? chalk.yellow('Dry Run') : chalk.green('Live')}`);

  if (!fs.existsSync(config.backupDir)) {
    console.log(chalk.yellow(`\n⚠️  Backup directory does not exist: ${config.backupDir}`));
    return;
  }
  const result = await applyRetentionPolicy(config);
  displaySummary(result, config);
  if (options.verbose && result.kept.length > 0) displayVerboseDetails(result.kept);
}

const program = new Command();
program
  .name('backup-retention')
  .description('Apply retention policy to backup files')
  .version('1.0.0')
  .option('-b, --backup-dir <path>', 'backup directory', DEFAULT_CONFIG.backupDir)
  .option('-d, --daily <days>', 'daily retention days', '30')
  .option('-w, --weekly <weeks>', 'weekly retention weeks', '12')
  .option('-m, --monthly <months>', 'monthly retention months', '12')
  .option('--dry-run', 'show what would be deleted without deleting')
  .option('--verbose', 'show detailed output')
  .action(async (options) => {
    try {
      await runRetentionPolicy(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

if (import.meta.url === `file://${process.argv[1]}`) program.parse();
