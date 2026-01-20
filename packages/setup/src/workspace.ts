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

/** Packages to build in order */
const BUILD_PACKAGES = [
  '@eddo/core-shared',
  '@eddo/core-server',
  '@eddo/core-client',
  '@eddo/core-instrumentation',
  '@eddo/setup',
];

/**
 * Build workspace packages with progress indication
 */
export function buildWorkspacePackages(rootDir: string): boolean {
  const spinner = ora('Building workspace packages...').start();
  let currentIndex = 0;

  const updateSpinner = (pkg: string): void => {
    currentIndex++;
    spinner.text = `Building packages (${currentIndex}/${BUILD_PACKAGES.length}): ${pkg}`;
  };

  for (const pkg of BUILD_PACKAGES) {
    updateSpinner(pkg);

    const result = spawnSync('pnpm', ['--filter', pkg, 'build'], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });

    if (result.status !== 0) {
      spinner.fail(chalk.red(`Failed to build ${pkg}`));
      if (result.stderr) {
        console.error(chalk.red(result.stderr.toString().slice(0, 500)));
      }
      return false;
    }
  }

  spinner.succeed(chalk.green(`Built ${BUILD_PACKAGES.length} packages successfully`));
  return true;
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
 * Password is passed via EDDO_USER_PASSWORD env var to avoid exposing in process list
 */
export function createDefaultUser(rootDir: string, password?: string): boolean {
  const env = { ...process.env };
  if (password) {
    env.EDDO_USER_PASSWORD = password;
  }

  const result = spawnSync('pnpm', ['dev:create-user'], {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf-8',
    env,
  });

  return result.status === 0;
}
