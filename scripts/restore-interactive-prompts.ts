/**
 * Interactive prompts for restore operations
 */

import chalk from 'chalk';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import prompts from 'prompts';
import {
  DEFAULT_CONFIG,
  formatFileSize,
  getAllBackupFiles,
  type BackupFileInfo as BackupFileInfoBase,
} from './backup-utils.js';

export interface RestoreConfig {
  url: string;
  database?: string;
  backupFile?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
  forceOverwrite: boolean;
}

interface BackupFileInfo extends BackupFileInfoBase {
  filename: string;
  fullPath: string;
  age: string;
}

/**
 * Parse CouchDB URL to extract components
 */
export function parseUrl(url: string): { baseUrl: string; defaultDb?: string } {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const defaultDb = pathParts.length > 0 ? pathParts[0] : undefined;
  parsed.pathname = '/';
  return { baseUrl: parsed.toString().replace(/\/$/, ''), defaultDb };
}

/**
 * Build full database URL
 */
export function buildDbUrl(baseUrl: string, database: string): string {
  return `${baseUrl}/${database}`;
}

/**
 * Get relative time string for a date
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
}

/**
 * Fetch available databases from CouchDB
 */
export async function fetchAvailableDatabases(baseUrl: string): Promise<string[]> {
  try {
    const parsed = new URL(baseUrl);
    const credentials =
      parsed.username && parsed.password
        ? Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64')
        : null;

    const cleanUrl = `${parsed.protocol}//${parsed.host}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (credentials) headers['Authorization'] = `Basic ${credentials}`;

    const response = await fetch(`${cleanUrl}/_all_dbs`, { headers });
    if (!response.ok) throw new Error(`Failed to fetch databases: ${response.statusText}`);

    const databases = (await response.json()) as string[];
    return databases.filter((db) => !db.startsWith('_'));
  } catch (error) {
    console.error(
      chalk.yellow('Warning: Could not fetch databases:'),
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

function getBackupFiles(backupDir: string): BackupFileInfo[] {
  const allBackups = getAllBackupFiles(backupDir);

  return allBackups.map((backup) => {
    const stats = fs.statSync(backup.path);
    return {
      filename: path.basename(backup.path),
      fullPath: backup.path,
      path: backup.path,
      database: backup.database,
      timestamp: backup.timestamp,
      size: formatFileSize(backup.size),
      age: getRelativeTime(stats.mtime),
    };
  });
}

/**
 * Create URL prompt question
 */
function createUrlPrompt(): prompts.PromptObject {
  return {
    type: 'text',
    name: 'url',
    message: 'CouchDB URL (e.g., http://admin:password@localhost:5984):',
    validate: (value: string) => {
      if (!value) return 'URL is required';
      try {
        new URL(value);
        return true;
      } catch {
        return 'Invalid URL format';
      }
    },
  };
}

/**
 * Create backup file selection prompts
 */
function createBackupFilePrompts(backupFiles: BackupFileInfo[]): prompts.PromptObject[] {
  if (backupFiles.length === 0) {
    console.log(chalk.yellow('⚠️  No backup files found'));
    return [
      {
        type: 'text',
        name: 'backupFile',
        message: 'Path to backup file:',
        validate: (value: string) => {
          if (!value) return 'Backup file path is required';
          if (!fs.existsSync(value)) return 'Backup file does not exist';
          return true;
        },
      },
    ];
  }

  const MAX_DISPLAY = 50;
  const displayBackups = backupFiles.slice(0, MAX_DISPLAY);

  console.log(chalk.green(`✅ Found ${backupFiles.length} backup file(s)`));
  if (backupFiles.length > MAX_DISPLAY) {
    console.log(chalk.yellow(`   Showing ${MAX_DISPLAY} most recent.`));
  }

  const choices = displayBackups.map((backup) => ({
    title: backup.filename,
    value: backup.fullPath,
    description: `${backup.database} | ${backup.size} | ${backup.age}`,
  }));

  choices.push({
    title: '📁 Browse for custom backup file',
    value: '__custom__',
    description: 'Manually specify backup file path',
  });

  return [
    { type: 'select', name: 'backupFile', message: 'Select backup file:', choices },
    {
      type: (prev: string) => (prev === '__custom__' ? 'text' : null),
      name: 'customBackupFile',
      message: 'Enter backup file path:',
      validate: (value: string) => {
        if (!value) return 'Backup file path is required';
        if (!fs.existsSync(value)) return 'Backup file does not exist';
        return true;
      },
    },
  ];
}

/**
 * Create database selection prompts
 */
function createDatabasePrompts(databases: string[], defaultDb?: string): prompts.PromptObject[] {
  if (databases.length === 0) {
    console.log(chalk.yellow('⚠️  No databases found'));
    return [{ type: 'text', name: 'database', message: 'Target database:', initial: defaultDb }];
  }

  console.log(chalk.green(`✅ Found ${databases.length} database(s)`));

  const choices = databases.map((db) => ({
    title: db,
    value: db,
    description: db === defaultDb ? '(from URL)' : '',
  }));

  choices.push({
    title: '📝 Enter custom database name',
    value: '__custom__',
    description: 'Manually type a database name',
  });

  const defaultIndex = defaultDb ? databases.findIndex((db) => db === defaultDb) : -1;

  return [
    {
      type: 'select',
      name: 'database',
      message: 'Select target database:',
      choices,
      initial: defaultIndex >= 0 ? defaultIndex : 0,
    },
    {
      type: (prev: string) => (prev === '__custom__' ? 'text' : null),
      name: 'customDatabase',
      message: 'Enter database name:',
      initial: defaultDb,
    },
  ];
}

function onCancel(): void {
  console.log(chalk.red('\nRestore cancelled.'));
  process.exit(0);
}

/**
 * Collect first phase answers (URL and backup file)
 */
async function collectFirstPhaseAnswers(
  options: Partial<RestoreConfig>,
  backupDir: string,
): Promise<{ answers: Record<string, unknown>; baseUrl: string; defaultDb?: string }> {
  const questions: prompts.PromptObject[] = [];
  let baseUrl = '';
  let defaultDb: string | undefined;

  if (!options.url) {
    questions.push(createUrlPrompt());
  } else {
    const parsed = parseUrl(options.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  }

  if (!options.backupFile) {
    const backupFiles = getBackupFiles(backupDir);
    questions.push(...createBackupFilePrompts(backupFiles));
  }

  const answers = await prompts(questions, { onCancel });

  if (answers.backupFile === '__custom__' && answers.customBackupFile) {
    answers.backupFile = answers.customBackupFile;
  }
  delete answers.customBackupFile;

  if (answers.url) {
    const parsed = parseUrl(answers.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  }

  return { answers, baseUrl, defaultDb };
}

/**
 * Collect second phase answers (database and options)
 */
async function collectSecondPhaseAnswers(
  options: Partial<RestoreConfig>,
  baseUrl: string,
  defaultDb?: string,
): Promise<Record<string, unknown>> {
  const questions: prompts.PromptObject[] = [];

  if (!options.database) {
    const spinner = ora('Discovering databases...').start();
    const databases = await fetchAvailableDatabases(baseUrl || options.url || '');
    spinner.stop();
    questions.push(...createDatabasePrompts(databases, defaultDb));
  }

  if (options.parallelism === undefined) {
    questions.push({
      type: 'number',
      name: 'parallelism',
      message: 'Parallel connections:',
      initial: DEFAULT_CONFIG.parallelism,
      min: 1,
      max: 10,
    });
  }

  if (options.timeout === undefined) {
    questions.push({
      type: 'number',
      name: 'timeout',
      message: 'Request timeout (ms):',
      initial: DEFAULT_CONFIG.timeout,
      min: 10000,
    });
  }

  questions.push({
    type: 'confirm',
    name: 'forceOverwrite',
    message: 'This will overwrite the target database. Continue?',
    initial: false,
  });

  const answers = await prompts(questions, { onCancel });

  if (answers.database === '__custom__' && answers.customDatabase) {
    answers.database = answers.customDatabase;
  }
  delete answers.customDatabase;

  return answers;
}

/**
 * Get restore configuration interactively
 */
export async function getRestoreConfig(options: Partial<RestoreConfig>): Promise<RestoreConfig> {
  const defaults: RestoreConfig = {
    url: '',
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
    dryRun: false,
    forceOverwrite: false,
  };

  console.log(chalk.blue('\n🔄 CouchDB Interactive Restore\n'));

  const backupDir = options.backupDir || defaults.backupDir;
  const {
    answers: firstAnswers,
    baseUrl,
    defaultDb,
  } = await collectFirstPhaseAnswers(options, backupDir);
  const secondAnswers = await collectSecondPhaseAnswers(options, baseUrl, defaultDb);

  return {
    ...defaults,
    ...options,
    ...firstAnswers,
    ...secondAnswers,
    url: baseUrl || options.url || '',
  } as RestoreConfig;
}
