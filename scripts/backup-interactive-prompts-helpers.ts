/**
 * Helper functions for backup interactive prompts
 */
import prompts from 'prompts';

import type { BackupConfig } from './backup-interactive-prompts.js';

/** Default backup configuration values */
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  url: '',
  backupDir: './backups',
  parallelism: 5,
  timeout: 30000,
  dryRun: false,
};

/** Check if all required options are provided */
export function hasAllRequiredOptions(options: Partial<BackupConfig>): boolean {
  return !!(
    options.url &&
    options.database &&
    options.backupDir !== undefined &&
    options.parallelism !== undefined &&
    options.timeout !== undefined
  );
}

/** Create prompts for optional backup settings */
export function createOptionPrompts(
  options: Partial<BackupConfig>,
  defaults: BackupConfig,
): prompts.PromptObject[] {
  const questions: prompts.PromptObject[] = [];

  if (options.backupDir === undefined) {
    questions.push({
      type: 'text',
      name: 'backupDir',
      message: 'Backup directory:',
      initial: defaults.backupDir,
    });
  }

  if (options.parallelism === undefined) {
    questions.push({
      type: 'number',
      name: 'parallelism',
      message: 'Parallel connections:',
      initial: defaults.parallelism,
      min: 1,
      max: 10,
    });
  }

  if (options.timeout === undefined) {
    questions.push({
      type: 'number',
      name: 'timeout',
      message: 'Request timeout (ms):',
      initial: defaults.timeout,
      min: 10000,
    });
  }

  return questions;
}

interface MergeConfigParams {
  defaults: BackupConfig;
  options: Partial<BackupConfig>;
  optionAnswers: Record<string, unknown>;
  baseUrl: string;
  database?: string;
}

/** Merge configuration from various sources */
export function mergeConfig(params: MergeConfigParams): BackupConfig {
  const { defaults, options, optionAnswers, baseUrl, database } = params;
  return {
    ...defaults,
    ...options,
    ...optionAnswers,
    url: baseUrl || options.url || '',
    database,
  };
}
