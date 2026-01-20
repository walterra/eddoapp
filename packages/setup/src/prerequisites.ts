/**
 * Prerequisite checking for setup wizard
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

export interface PrerequisiteResult {
  name: string;
  passed: boolean;
  message: string;
  version?: string;
}

/**
 * Execute a command and return stdout or null on error
 */
export function execCommand(command: string, args: string = ''): string | null {
  try {
    const fullCommand = args ? `${command} ${args}` : command;
    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Extract version number from version string
 */
export function extractVersion(versionString: string): string {
  const match = versionString.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : versionString;
}

/**
 * Compare semver versions
 */
export function isVersionAtLeast(current: string, minimum: string): boolean {
  const currentParts = current.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0;
    const min = minimumParts[i] || 0;
    if (curr > min) return true;
    if (curr < min) return false;
  }
  return true;
}

/**
 * Check a single prerequisite with version
 */
export function checkVersionedPrerequisite(
  name: string,
  command: string,
  minVersion: string,
  installHint: string,
): PrerequisiteResult {
  const versionOutput = execCommand(command, '--version');

  if (!versionOutput) {
    return { name, passed: false, message: `${name} not found. ${installHint}` };
  }

  const version = extractVersion(versionOutput);
  const passed = isVersionAtLeast(version, minVersion);

  return {
    name,
    passed,
    version,
    message: passed
      ? `${name} ${version} installed`
      : `${name} ${version} found, but ${minVersion}+ required`,
  };
}

/**
 * Display prerequisite check results
 */
export function displayPrerequisites(results: PrerequisiteResult[]): boolean {
  console.log('\n' + chalk.bold('📋 Checking prerequisites...\n'));

  let allPassed = true;
  for (const result of results) {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    const name = result.passed ? chalk.green(result.name) : chalk.red(result.name);
    console.log(`  ${icon} ${name}: ${result.message}`);
    if (!result.passed) allPassed = false;
  }

  console.log('');
  return allPassed;
}

/**
 * Check if Docker daemon is running
 */
export function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check all prerequisites
 */
export function checkPrerequisites(): PrerequisiteResult[] {
  const results: PrerequisiteResult[] = [];

  results.push(
    checkVersionedPrerequisite('Node.js', 'node', '18.11.0', 'Install from https://nodejs.org/'),
  );

  results.push(
    checkVersionedPrerequisite('pnpm', 'pnpm', '7.1.0', 'Install with: npm install -g pnpm'),
  );

  results.push(
    checkVersionedPrerequisite(
      'Docker',
      'docker',
      '20.0.0',
      'Install from https://www.docker.com/products/docker-desktop/',
    ),
  );

  const dockerRunning = isDockerRunning();
  results.push({
    name: 'Docker Daemon',
    passed: dockerRunning,
    message: dockerRunning
      ? 'Docker daemon is running'
      : 'Docker daemon not running. Start Docker Desktop or run: sudo systemctl start docker',
  });

  results.push(
    checkVersionedPrerequisite('Git', 'git', '2.0.0', 'Install from https://git-scm.com/'),
  );

  return results;
}
