/**
 * Helper functions for cleanup-interactive script
 * Extracted to reduce function complexity
 */
import chalk from 'chalk';
import { type Command } from 'commander';

interface ProgramOptions {
  mode?: string;
  pattern?: string;
  age?: number;
  dryRun?: boolean;
  force?: boolean;
  databases?: string;
}

export interface CleanupConfig {
  mode: 'all' | 'pattern' | 'age' | 'custom';
  pattern?: string;
  age?: number;
  dryRun: boolean;
  force: boolean;
  databases?: string[];
}

/**
 * Detect cleanup mode based on provided options
 */
function detectMode(options: ProgramOptions): CleanupConfig['mode'] {
  const mode = options.mode as CleanupConfig['mode'];
  if (options.pattern && mode === 'all') {
    return 'pattern';
  }
  if (options.databases && mode === 'all') {
    return 'custom';
  }
  return mode;
}

/**
 * Parse command options into CleanupConfig
 */
export function parseCleanupConfig(options: ProgramOptions): CleanupConfig {
  const mode = detectMode(options);
  return {
    mode,
    pattern: options.pattern,
    age: options.age,
    dryRun: options.dryRun ?? false,
    force: options.force ?? false,
    databases: options.databases?.split(',').map((db: string) => db.trim()),
  };
}

/**
 * Print warning message for non-force mode
 */
export function printWarningIfNeeded(force: boolean): void {
  if (!force) {
    console.log(
      chalk.yellow('⚠️  This tool will delete databases. Make sure you have backups if needed.\n'),
    );
  }
}

/**
 * Handle specific error types with helpful messages
 */
export function handleCleanupError(error: unknown): void {
  console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));

  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.error(chalk.yellow('\nℹ️  Make sure CouchDB is running and accessible'));
    } else if (error.message.includes('unauthorized')) {
      console.error(
        chalk.yellow('\nℹ️  Check your CouchDB credentials in the environment variables'),
      );
    }
  }
}

/**
 * Setup commander program with all options
 */
export function setupProgram(program: Command): void {
  program
    .name('cleanup-interactive')
    .description('Interactive CouchDB test database cleanup tool')
    .option('-m, --mode <mode>', 'cleanup mode: all, pattern, age, custom', 'all')
    .option('-p, --pattern <pattern>', 'database name pattern to match')
    .option('-a, --age <days>', 'delete databases older than N days', parseInt)
    .option('-d, --dry-run', 'show what would be deleted without actually deleting', false)
    .option('-f, --force', 'skip confirmation prompts', false)
    .option('--databases <databases>', 'comma-separated list of specific databases to clean');
}
