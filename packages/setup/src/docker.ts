/**
 * Docker service management for setup wizard
 */

import chalk from 'chalk';
import { execSync, spawn, spawnSync } from 'child_process';
import ora from 'ora';

/**
 * Check if a Docker container is running.
 * Uses spawnSync with args array to prevent shell injection.
 */
export function isContainerRunning(containerName: string): boolean {
  try {
    // Validate container name to prevent injection (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(containerName)) {
      return false;
    }
    const result = spawnSync(
      'docker',
      ['ps', '--filter', `name=${containerName}`, '--format', '{{.Names}}'],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    return result.stdout?.trim().includes(containerName) ?? false;
  } catch {
    return false;
  }
}

/**
 * Check if CouchDB is healthy
 */
export function isCouchDBHealthy(): boolean {
  try {
    execSync('curl -sf http://localhost:5984/_up', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Elasticsearch is healthy
 */
export function isElasticsearchHealthy(): boolean {
  try {
    execSync('curl -sf http://localhost:9222/_cluster/health', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if pi-coding-agent Docker image exists
 */
export function isPiCodingAgentImageExists(): boolean {
  try {
    const result = execSync('docker images -q pi-coding-agent:latest', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Start Docker services using docker-compose
 */
export async function startDockerServices(rootDir: string): Promise<boolean> {
  const spinner = ora('Starting Docker services...').start();

  return new Promise((resolve) => {
    const dockerCompose = spawn('docker', ['compose', 'up', '-d', 'couchdb', 'elasticsearch'], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    dockerCompose.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    dockerCompose.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green('Docker services started successfully'));
        resolve(true);
      } else {
        spinner.fail(chalk.red('Failed to start Docker services'));
        console.error(chalk.red(stderr));
        resolve(false);
      }
    });

    dockerCompose.on('error', (err) => {
      spinner.fail(chalk.red('Failed to start Docker services'));
      console.error(chalk.red(err.message));
      resolve(false);
    });
  });
}

/**
 * Wait for a service to be healthy
 */
export async function waitForService(
  name: string,
  checkFn: () => boolean,
  maxAttempts: number = 30,
  intervalMs: number = 2000,
): Promise<boolean> {
  const spinner = ora(`Waiting for ${name} to be ready...`).start();

  for (let i = 0; i < maxAttempts; i++) {
    if (checkFn()) {
      spinner.succeed(chalk.green(`${name} is ready`));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    spinner.text = `Waiting for ${name} to be ready... (${i + 1}/${maxAttempts})`;
  }

  spinner.fail(chalk.red(`${name} did not become ready in time`));
  return false;
}

/**
 * Build pi-coding-agent Docker image for chat feature
 */
export function buildPiCodingAgentImage(rootDir: string): boolean {
  console.log(chalk.blue('\n📦 Building pi-coding-agent Docker image...\n'));
  console.log(chalk.gray('  This may take a few minutes on first build.\n'));

  const spinner = ora('Building Docker image...').start();

  const result = spawnSync(
    'docker',
    ['build', '-t', 'pi-coding-agent:latest', '-f', 'docker/pi-coding-agent/Dockerfile', '.'],
    {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    },
  );

  if (result.status === 0) {
    spinner.succeed('Docker image pi-coding-agent:latest built successfully');
    return true;
  } else {
    spinner.fail('Failed to build Docker image');
    if (result.stderr) {
      console.log(chalk.red('\n  Error output:'));
      console.log(chalk.gray('  ' + result.stderr.split('\n').slice(-10).join('\n  ')));
    }
    return false;
  }
}
