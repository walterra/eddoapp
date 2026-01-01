#!/usr/bin/env tsx

/**
 * Backup Retention Policy Manager
 * Manages backup file lifecycle with configurable retention periods
 *
 * Retention Strategy:
 * - Daily backups: Keep for N days (default: 30)
 * - Weekly backups: Keep oldest daily from each week for N weeks (default: 12)
 * - Monthly backups: Keep oldest weekly from each month for N months (default: 12)
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import path from 'path';

import {
  DEFAULT_CONFIG,
  formatFileSize,
  getAllBackupFiles,
  type BackupFileInfo,
} from './backup-utils.js';

// Load environment variables
dotenvLoad();

export interface RetentionConfig {
  /** Number of days to keep daily backups */
  dailyRetentionDays: number;
  /** Number of weeks to keep weekly backups */
  weeklyRetentionWeeks: number;
  /** Number of months to keep monthly backups */
  monthlyRetentionMonths: number;
  /** Dry run mode - show what would be deleted without deleting */
  dryRun: boolean;
}

export interface RetentionPolicyConfig extends RetentionConfig {
  /** Backup directory to apply policy to */
  backupDir: string;
}

interface BackupFileWithDate extends BackupFileInfo {
  date: Date;
  weekKey: string; // YYYY-WW format
  monthKey: string; // YYYY-MM format
}

interface RetentionResult {
  kept: BackupFileWithDate[];
  deleted: BackupFileWithDate[];
  errors: Array<{ file: string; error: string }>;
  freedBytes: number;
}

interface CategorizedBackups {
  daily: BackupFileWithDate[];
  weekly: BackupFileWithDate[];
  monthly: BackupFileWithDate[];
  toDelete: BackupFileWithDate[];
}

/**
 * Default retention configuration
 */
export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  dailyRetentionDays: 30,
  weeklyRetentionWeeks: 12,
  monthlyRetentionMonths: 12,
  dryRun: false,
};

/**
 * Parse ISO timestamp from backup filename
 * Handles the format from getAllBackupFiles which has all dashes replaced with colons
 */
function parseBackupDate(backup: BackupFileInfo): Date | null {
  try {
    // Timestamp from backup-utils.ts has format: 2025:12:24T23:04:15:080Z (all dashes to colons)
    // We need to convert back to ISO: 2025-12-24T23:04:15.080Z
    const timestamp = backup.timestamp;

    // Match pattern: YYYY:MM:DDTHH:MM:SS:mmmZ
    const match = timestamp.match(/^(\d{4}):(\d{2}):(\d{2})T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z$/);
    if (match) {
      const [, year, month, day, hour, min, sec, ms] = match;
      const isoTimestamp = `${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`;
      return new Date(isoTimestamp);
    }

    // Fallback: try direct parsing
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get week key (YYYY-WW) for a date
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date).toString().padStart(2, '0');
  return `${year}-W${week}`;
}

/**
 * Get month key (YYYY-MM) for a date
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculate cutoff dates for retention tiers
 */
function calculateCutoffs(config: RetentionConfig): {
  daily: Date;
  weekly: Date;
  monthly: Date;
} {
  const now = new Date();
  return {
    daily: new Date(now.getTime() - config.dailyRetentionDays * 24 * 60 * 60 * 1000),
    weekly: new Date(now.getTime() - config.weeklyRetentionWeeks * 7 * 24 * 60 * 60 * 1000),
    monthly: new Date(now.getTime() - config.monthlyRetentionMonths * 30 * 24 * 60 * 60 * 1000),
  };
}

/**
 * Categorize a backup into its retention tier
 */
function categorizeBackup(
  backup: BackupFileWithDate,
  cutoffs: { daily: Date; weekly: Date; monthly: Date },
  keptWeeks: Set<string>,
  keptMonths: Set<string>,
): 'daily' | 'weekly' | 'monthly' | 'delete' {
  // Daily tier: keep all backups within daily retention period
  if (backup.date >= cutoffs.daily) {
    keptWeeks.add(backup.weekKey);
    keptMonths.add(backup.monthKey);
    return 'daily';
  }

  // Weekly tier: keep oldest backup from each week within weekly retention period
  if (backup.date >= cutoffs.weekly) {
    if (!keptWeeks.has(backup.weekKey)) {
      keptWeeks.add(backup.weekKey);
      keptMonths.add(backup.monthKey);
      return 'weekly';
    }
    return 'delete';
  }

  // Monthly tier: keep oldest backup from each month within monthly retention period
  if (backup.date >= cutoffs.monthly) {
    if (!keptMonths.has(backup.monthKey)) {
      keptMonths.add(backup.monthKey);
      return 'monthly';
    }
    return 'delete';
  }

  // Beyond all retention periods
  return 'delete';
}

/**
 * Categorize backups by retention tier
 */
function categorizeBackups(
  backups: BackupFileWithDate[],
  config: RetentionConfig,
): CategorizedBackups {
  const cutoffs = calculateCutoffs(config);

  // Sort by date, newest first
  const sorted = [...backups].sort((a, b) => b.date.getTime() - a.date.getTime());

  const result: CategorizedBackups = {
    daily: [],
    weekly: [],
    monthly: [],
    toDelete: [],
  };

  // Track which weeks and months we've already kept a backup for
  const keptWeeks = new Set<string>();
  const keptMonths = new Set<string>();

  for (const backup of sorted) {
    const tier = categorizeBackup(backup, cutoffs, keptWeeks, keptMonths);
    if (tier === 'delete') {
      result.toDelete.push(backup);
    } else {
      result[tier].push(backup);
    }
  }

  return result;
}

/**
 * Delete a backup file and its log file
 */
function deleteBackupFile(
  backup: BackupFileWithDate,
  dryRun: boolean,
): { success: boolean; error?: string } {
  if (dryRun) {
    return { success: true };
  }

  try {
    fs.unlinkSync(backup.path);

    // Also delete the log file if it exists
    const logFile = `${backup.path}.log`;
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply retention policy to a single database's backups
 */
function applyPolicyToDatabase(
  dbBackups: BackupFileWithDate[],
  config: RetentionConfig,
  result: RetentionResult,
): void {
  const categorized = categorizeBackups(dbBackups, config);

  // Keep daily, weekly, and monthly backups
  result.kept.push(...categorized.daily, ...categorized.weekly, ...categorized.monthly);

  // Delete expired backups
  for (const backup of categorized.toDelete) {
    const deleteResult = deleteBackupFile(backup, config.dryRun);
    if (deleteResult.success) {
      result.deleted.push(backup);
      result.freedBytes += backup.size;
    } else if (deleteResult.error) {
      result.errors.push({ file: backup.path, error: deleteResult.error });
    }
  }
}

/**
 * Group backups by database
 */
function groupByDatabase(backups: BackupFileWithDate[]): Map<string, BackupFileWithDate[]> {
  const byDatabase = new Map<string, BackupFileWithDate[]>();
  for (const backup of backups) {
    const existing = byDatabase.get(backup.database) || [];
    existing.push(backup);
    byDatabase.set(backup.database, existing);
  }
  return byDatabase;
}

/**
 * Apply retention policy to backup files
 */
export async function applyRetentionPolicy(
  config: RetentionPolicyConfig,
): Promise<RetentionResult> {
  const result: RetentionResult = {
    kept: [],
    deleted: [],
    errors: [],
    freedBytes: 0,
  };

  // Get all backup files
  const allBackups = getAllBackupFiles(config.backupDir);

  if (allBackups.length === 0) {
    return result;
  }

  // Parse dates and add metadata
  const backupsWithDates: BackupFileWithDate[] = [];
  for (const backup of allBackups) {
    const date = parseBackupDate(backup);
    if (date) {
      backupsWithDates.push({
        ...backup,
        date,
        weekKey: getWeekKey(date),
        monthKey: getMonthKey(date),
      });
    }
  }

  // Group by database and apply policy per database
  const byDatabase = groupByDatabase(backupsWithDates);

  for (const [, dbBackups] of byDatabase) {
    applyPolicyToDatabase(dbBackups, config, result);
  }

  return result;
}

/**
 * Display deleted backups list
 */
function displayDeletedList(deleted: BackupFileWithDate[]): void {
  if (deleted.length <= 10) {
    deleted.forEach((backup) => {
      console.log(
        chalk.gray(
          `   - ${path.basename(backup.path)} (${backup.date.toISOString().split('T')[0]})`,
        ),
      );
    });
  } else {
    deleted.slice(0, 5).forEach((backup) => {
      console.log(
        chalk.gray(
          `   - ${path.basename(backup.path)} (${backup.date.toISOString().split('T')[0]})`,
        ),
      );
    });
    console.log(chalk.gray(`   ... and ${deleted.length - 5} more`));
  }
}

/**
 * Display retention policy summary
 */
function displaySummary(result: RetentionResult, config: RetentionPolicyConfig): void {
  console.log(chalk.bold('\n📊 Retention Policy Summary'));
  console.log('─'.repeat(50));

  // Group kept backups by tier
  const cutoffs = calculateCutoffs(config);

  const dailyKept = result.kept.filter((b) => b.date >= cutoffs.daily);
  const weeklyKept = result.kept.filter((b) => b.date < cutoffs.daily && b.date >= cutoffs.weekly);
  const monthlyKept = result.kept.filter((b) => b.date < cutoffs.weekly);

  console.log(chalk.green(`\n✅ Kept: ${result.kept.length} backup(s)`));
  console.log(`   Daily (last ${config.dailyRetentionDays} days): ${dailyKept.length}`);
  console.log(`   Weekly (last ${config.weeklyRetentionWeeks} weeks): ${weeklyKept.length}`);
  console.log(`   Monthly (last ${config.monthlyRetentionMonths} months): ${monthlyKept.length}`);

  if (result.deleted.length > 0) {
    const actionWord = config.dryRun ? 'Would delete' : 'Deleted';
    const icon = config.dryRun ? '🔍' : '🗑️ ';
    console.log(chalk.yellow(`\n${icon} ${actionWord}: ${result.deleted.length} backup(s)`));
    const freedWord = config.dryRun ? 'to be freed' : 'freed';
    console.log(`   Space ${freedWord}: ${formatFileSize(result.freedBytes)}`);
    displayDeletedList(result.deleted);
  }

  if (result.errors.length > 0) {
    console.log(chalk.red(`\n❌ Errors: ${result.errors.length}`));
    result.errors.forEach((err) => {
      console.log(chalk.red(`   - ${err.file}: ${err.error}`));
    });
  }

  if (config.dryRun) {
    console.log(chalk.yellow('\n⚠️  Dry run mode - no files were deleted'));
  }

  console.log();
}

/**
 * Display verbose backup details
 */
function displayVerboseDetails(kept: BackupFileWithDate[]): void {
  console.log(chalk.bold('Kept Backups:'));

  // Group by database
  const byDatabase = groupByDatabase(kept);

  for (const [database, backups] of byDatabase) {
    console.log(`\n  ${chalk.cyan(database)} (${backups.length} backups):`);
    backups
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .forEach((backup) => {
        console.log(
          chalk.gray(`    - ${path.basename(backup.path)} (${formatFileSize(backup.size)})`),
        );
      });
    if (backups.length > 5) {
      console.log(chalk.gray(`    ... and ${backups.length - 5} more`));
    }
  }
  console.log();
}

/**
 * Run retention policy with CLI options
 */
async function runRetentionPolicy(options: {
  backupDir: string;
  daily: string;
  weekly: string;
  monthly: string;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<void> {
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

  // Check if backup directory exists
  if (!fs.existsSync(config.backupDir)) {
    console.log(chalk.yellow(`\n⚠️  Backup directory does not exist: ${config.backupDir}`));
    return;
  }

  const result = await applyRetentionPolicy(config);
  displaySummary(result, config);

  if (options.verbose && result.kept.length > 0) {
    displayVerboseDetails(result.kept);
  }
}

// CLI setup
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

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
