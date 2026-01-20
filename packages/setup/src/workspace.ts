/**
 * Workspace setup utilities
 */

import chalk from 'chalk';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import ora from 'ora';
import path from 'path';

/**
 * Ensure logs directory exists
 */
export function ensureLogsDirectory(rootDir: string): void {
  const logsDir = path.join(rootDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(chalk.green('  ✓ Created logs directory'));
  }
}

/**
 * Build workspace packages (core-shared, core-server, core-client)
 */
export function buildWorkspacePackages(rootDir: string): boolean {
  const spinner = ora('Building workspace packages...').start();

  const result = spawnSync('pnpm', ['build'], {
    cwd: rootDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });

  if (result.status === 0) {
    spinner.succeed(chalk.green('Workspace packages built successfully'));
    return true;
  } else {
    spinner.fail(chalk.red('Failed to build workspace packages'));
    if (result.stderr) {
      console.error(chalk.red(result.stderr.toString().slice(0, 500)));
    }
    return false;
  }
}

/**
 * Check if default user already exists by querying CouchDB directly
 */
export function checkDefaultUserExists(): boolean {
  try {
    const result = execSync(
      'curl -sf http://admin:password@localhost:5984/user_registry_alpha2/eddo_pi_agent',
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' },
    );
    return result.includes('"username":"eddo_pi_agent"');
  } catch {
    return false;
  }
}

/**
 * Create default development user directly in CouchDB
 */
export function createDefaultUser(rootDir: string, password?: string): boolean {
  const args = ['dev:create-user'];
  if (password) {
    args.push('--', '--password', password);
  }

  const result = spawnSync('pnpm', args, {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  return result.status === 0;
}
