/**
 * Interactive prompts for backup operations
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { DEFAULT_CONFIG } from './backup-utils.js';

export interface BackupConfig {
  url: string;
  database?: string;
  backupDir: string;
  parallelism: number;
  timeout: number;
  dryRun: boolean;
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
 * Fetch available databases from CouchDB
 */
async function fetchAvailableDatabases(baseUrl: string): Promise<string[]> {
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

function onCancel(): void {
  console.log(chalk.red('\nBackup cancelled.'));
  process.exit(0);
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
 * Create database selection prompts
 */
function createDatabasePrompts(databases: string[], defaultDb?: string): prompts.PromptObject[] {
  if (databases.length === 0) {
    console.log(chalk.yellow('⚠️  No databases found'));
    return [{ type: 'text', name: 'database', message: 'Database name:', initial: defaultDb }];
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
      message: 'Select database to backup:',
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

/**
 * Prompt for database selection
 */
async function promptForDatabase(baseUrl: string, defaultDb?: string): Promise<string | undefined> {
  const spinner = ora('Discovering available databases...').start();
  const availableDatabases = await fetchAvailableDatabases(baseUrl);
  spinner.stop();

  const questions = createDatabasePrompts(availableDatabases, defaultDb);
  const answers = await prompts(questions, { onCancel });

  if (answers.database === '__custom__' && answers.customDatabase) {
    return answers.customDatabase;
  }
  return answers.database;
}

/**
 * Get backup configuration interactively
 */
export async function getBackupConfig(options: Partial<BackupConfig>): Promise<BackupConfig> {
  const defaults: BackupConfig = {
    url: '',
    backupDir: DEFAULT_CONFIG.backupDir,
    parallelism: DEFAULT_CONFIG.parallelism,
    timeout: DEFAULT_CONFIG.timeout,
    dryRun: false,
  };

  // If all required options are provided, return without prompting
  if (
    options.url &&
    options.database &&
    options.backupDir !== undefined &&
    options.parallelism !== undefined &&
    options.timeout !== undefined
  ) {
    const { baseUrl } = parseUrl(options.url);
    return { ...defaults, ...options, url: baseUrl || options.url } as BackupConfig;
  }

  console.log(chalk.blue('\n🗄️  CouchDB Interactive Backup\n'));

  let baseUrl = '';
  let defaultDb: string | undefined;
  let database = options.database;

  // Handle URL
  if (!options.url) {
    const { url } = await prompts(createUrlPrompt(), { onCancel });
    const parsed = parseUrl(url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  } else {
    const parsed = parseUrl(options.url);
    baseUrl = parsed.baseUrl;
    defaultDb = parsed.defaultDb;
  }

  // Handle database
  if (!database) {
    database = await promptForDatabase(baseUrl, defaultDb);
  }

  // Handle other options
  const optionQuestions: prompts.PromptObject[] = [];

  if (options.backupDir === undefined) {
    optionQuestions.push({
      type: 'text',
      name: 'backupDir',
      message: 'Backup directory:',
      initial: defaults.backupDir,
    });
  }

  if (options.parallelism === undefined) {
    optionQuestions.push({
      type: 'number',
      name: 'parallelism',
      message: 'Parallel connections:',
      initial: defaults.parallelism,
      min: 1,
      max: 10,
    });
  }

  if (options.timeout === undefined) {
    optionQuestions.push({
      type: 'number',
      name: 'timeout',
      message: 'Request timeout (ms):',
      initial: defaults.timeout,
      min: 10000,
    });
  }

  const optionAnswers =
    optionQuestions.length > 0 ? await prompts(optionQuestions, { onCancel }) : {};

  return {
    ...defaults,
    ...options,
    ...optionAnswers,
    url: baseUrl || options.url || '',
    database,
  };
}
