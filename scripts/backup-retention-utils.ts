/**
 * Utility functions for backup retention policy
 */
import fs from 'fs';

import type { BackupFileInfo } from './backup-utils.js';

export interface RetentionConfig {
  dailyRetentionDays: number;
  weeklyRetentionWeeks: number;
  monthlyRetentionMonths: number;
  dryRun: boolean;
}

export interface BackupFileWithDate extends BackupFileInfo {
  date: Date;
  weekKey: string;
  monthKey: string;
}

export interface CategorizedBackups {
  daily: BackupFileWithDate[];
  weekly: BackupFileWithDate[];
  monthly: BackupFileWithDate[];
  toDelete: BackupFileWithDate[];
}

export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  dailyRetentionDays: 30,
  weeklyRetentionWeeks: 12,
  monthlyRetentionMonths: 12,
  dryRun: false,
};

/** Parse ISO timestamp from backup filename */
export function parseBackupDate(backup: BackupFileInfo): Date | null {
  try {
    const timestamp = backup.timestamp;
    const match = timestamp.match(/^(\d{4}):(\d{2}):(\d{2})T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z$/);
    if (match) {
      const [, year, month, day, hour, min, sec, ms] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`);
    }
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/** Get ISO week number for a date */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get week key (YYYY-WW) for a date */
export function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date).toString().padStart(2, '0');
  return `${year}-W${week}`;
}

/** Get month key (YYYY-MM) for a date */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/** Calculate cutoff dates for retention tiers */
export function calculateCutoffs(config: RetentionConfig) {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    daily: new Date(now.getTime() - config.dailyRetentionDays * msPerDay),
    weekly: new Date(now.getTime() - config.weeklyRetentionWeeks * 7 * msPerDay),
    monthly: new Date(now.getTime() - config.monthlyRetentionMonths * 30 * msPerDay),
  };
}

type Cutoffs = ReturnType<typeof calculateCutoffs>;

/** Categorize a backup into its retention tier */
function categorizeBackup(
  backup: BackupFileWithDate,
  cutoffs: Cutoffs,
  keptWeeks: Set<string>,
  keptMonths: Set<string>,
): 'daily' | 'weekly' | 'monthly' | 'delete' {
  if (backup.date >= cutoffs.daily) {
    keptWeeks.add(backup.weekKey);
    keptMonths.add(backup.monthKey);
    return 'daily';
  }
  if (backup.date >= cutoffs.weekly) {
    if (!keptWeeks.has(backup.weekKey)) {
      keptWeeks.add(backup.weekKey);
      keptMonths.add(backup.monthKey);
      return 'weekly';
    }
    return 'delete';
  }
  if (backup.date >= cutoffs.monthly) {
    if (!keptMonths.has(backup.monthKey)) {
      keptMonths.add(backup.monthKey);
      return 'monthly';
    }
    return 'delete';
  }
  return 'delete';
}

/** Categorize backups by retention tier */
export function categorizeBackups(
  backups: BackupFileWithDate[],
  config: RetentionConfig,
): CategorizedBackups {
  const cutoffs = calculateCutoffs(config);
  const sorted = [...backups].sort((a, b) => b.date.getTime() - a.date.getTime());
  const result: CategorizedBackups = { daily: [], weekly: [], monthly: [], toDelete: [] };
  const keptWeeks = new Set<string>();
  const keptMonths = new Set<string>();

  for (const backup of sorted) {
    const tier = categorizeBackup(backup, cutoffs, keptWeeks, keptMonths);
    if (tier === 'delete') result.toDelete.push(backup);
    else result[tier].push(backup);
  }
  return result;
}

/** Delete a backup file and its log file */
export function deleteBackupFile(
  backup: BackupFileWithDate,
  dryRun: boolean,
): { success: boolean; error?: string } {
  if (dryRun) return { success: true };
  try {
    fs.unlinkSync(backup.path);
    const logFile = `${backup.path}.log`;
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Convert BackupFileInfo array to BackupFileWithDate array */
export function enrichBackupFiles(files: BackupFileInfo[]): BackupFileWithDate[] {
  return files
    .filter((f) => {
      const date = parseBackupDate(f);
      return date !== null;
    })
    .map((f) => {
      const date = parseBackupDate(f)!;
      return { ...f, date, weekKey: getWeekKey(date), monthKey: getMonthKey(date) };
    });
}
