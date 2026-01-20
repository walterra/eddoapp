/**
 * Helper functions for the doctor diagnostic tool
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

export interface DiagnosticResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

/**
 * Execute a command and return stdout or null on error
 */
export function exec(command: string): string | null {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Extract version from version string
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
 * Check if a port is in use
 */
export function isPortInUse(port: number): boolean {
  const result = exec(`lsof -i :${port}`);
  return result !== null && result.length > 0;
}

/**
 * Get process using a port
 */
export function getProcessOnPort(port: number): string | null {
  const result = exec(`lsof -i :${port} -t`);
  if (!result) return null;
  const pid = result.split('\n')[0];
  return exec(`ps -p ${pid} -o comm=`) || pid;
}

/**
 * Check if Docker container is running
 */
export function isContainerRunning(containerName: string): boolean {
  const result = exec(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`);
  return result !== null && result.includes(containerName);
}

/**
 * Check if Docker container exists (running or stopped)
 */
export function containerExists(containerName: string): boolean {
  const result = exec(`docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`);
  return result !== null && result.includes(containerName);
}

export interface PrereqCheckOptions {
  name: string;
  command: string;
  versionArg: string;
  minVersion: string;
  installHint: string;
}

/**
 * Check versioned prerequisite
 */
export function checkVersionedPrereq(options: PrereqCheckOptions): DiagnosticResult {
  const { name, command, versionArg, minVersion, installHint } = options;
  const versionOutput = exec(`${command} ${versionArg}`);

  if (!versionOutput) {
    return { name, status: 'fail', message: `${name} not found`, fix: installHint };
  }

  const version = extractVersion(versionOutput);
  if (isVersionAtLeast(version, minVersion)) {
    return {
      name,
      status: 'pass',
      message: `${name} ${version} installed (>= ${minVersion} required)`,
    };
  }

  return {
    name,
    status: 'fail',
    message: `${name} ${version} installed, but ${minVersion}+ required`,
    fix: `Update ${name}`,
  };
}

/**
 * Check Docker container status
 */
export function checkContainerStatus(containerName: string, displayName: string): DiagnosticResult {
  if (isContainerRunning(containerName)) {
    return { name: displayName, status: 'pass', message: `${containerName} container is running` };
  }

  if (containerExists(containerName)) {
    return {
      name: displayName,
      status: 'warn',
      message: `${containerName} container exists but is stopped`,
      fix: `Start with: docker compose up -d ${containerName.replace('eddo-', '')}`,
    };
  }

  return {
    name: displayName,
    status: 'fail',
    message: `${containerName} container not found`,
    fix: 'Run: pnpm dev:setup (or docker compose up -d)',
  };
}

/**
 * Check service health endpoint
 */
export function checkServiceHealth(name: string, url: string, port: number): DiagnosticResult {
  const health = exec(`curl -sf ${url}`);

  if (health) {
    return { name, status: 'pass', message: `${name} is responding on port ${port}` };
  }

  return {
    name,
    status: 'warn',
    message: `${name} container running but not responding yet`,
    fix: 'Wait a few seconds for the service to initialize',
  };
}

/**
 * Check port availability
 */
export function checkPort(
  port: number,
  service: string,
  isDockerService: boolean,
): DiagnosticResult {
  if (!isPortInUse(port)) {
    if (isDockerService) {
      return {
        name: `Port ${port}`,
        status: 'warn',
        message: `Port ${port} is free (${service} not running)`,
        fix: 'Run: docker compose up -d',
      };
    }
    return {
      name: `Port ${port}`,
      status: 'pass',
      message: `Port ${port} is available for ${service}`,
    };
  }

  const process = getProcessOnPort(port);
  const isBrowserClient = isBrowserProcess(process);
  const isExpected = isExpectedProcess(port, process);

  if (isExpected || isBrowserClient) {
    const suffix = isBrowserClient ? ' (browser connected)' : ` (${process})`;
    return {
      name: `Port ${port}`,
      status: 'pass',
      message: `Port ${port} in use by ${service}${suffix}`,
    };
  }

  return {
    name: `Port ${port}`,
    status: 'warn',
    message: `Port ${port} (${service}) in use by: ${process}`,
    fix: `Kill process: kill $(lsof -t -i:${port})`,
  };
}

/**
 * Check if process is a browser
 */
function isBrowserProcess(process: string | null): boolean {
  if (!process) return false;
  const lower = process.toLowerCase();
  return ['webkit', 'chrome', 'firefox', 'safari', 'orion'].some((b) => lower.includes(b));
}

/**
 * Check if process is expected for port
 */
function isExpectedProcess(port: number, process: string | null): boolean {
  if (!process) return false;
  const isDocker = process.includes('docker');
  const isNode = process.includes('node') || process.includes('tsx');

  return (
    (port === 5984 && isDocker) ||
    (port === 9222 && isDocker) ||
    (port === 3000 && isNode) ||
    (port === 5173 && isNode)
  );
}

/**
 * Display a group of results
 */
export function displayResultGroup(groupName: string, results: DiagnosticResult[]): void {
  console.log(chalk.bold(`📋 ${groupName}\n`));

  for (const result of results) {
    const icon =
      result.status === 'pass'
        ? chalk.green('✓')
        : result.status === 'warn'
          ? chalk.yellow('⚠')
          : chalk.red('✗');

    const color =
      result.status === 'pass' ? chalk.green : result.status === 'warn' ? chalk.yellow : chalk.red;

    console.log(`  ${icon} ${color(result.name)}: ${result.message}`);

    if (result.fix && result.status !== 'pass') {
      console.log(chalk.gray(`    → Fix: ${result.fix}`));
    }
  }

  console.log('');
}

/**
 * Display summary
 */
export function displaySummary(results: DiagnosticResult[]): void {
  const passCount = results.filter((r) => r.status === 'pass').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  console.log(chalk.bold('Summary:'));
  console.log(
    `  ${chalk.green('✓')} ${passCount} passed  ` +
      `${chalk.yellow('⚠')} ${warnCount} warnings  ` +
      `${chalk.red('✗')} ${failCount} failed`,
  );
  console.log('');

  if (failCount > 0) {
    console.log(chalk.red('❌ Some checks failed. Please fix the issues above.\n'));
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(chalk.yellow('⚠️  Some warnings detected. Review the issues above.\n'));
  } else {
    console.log(chalk.green('✅ All checks passed! Your environment is ready.\n'));
    console.log(chalk.gray('Start development with: pnpm dev\n'));
  }
}
