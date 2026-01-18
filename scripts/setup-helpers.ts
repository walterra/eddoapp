/**
 * Helper functions for the setup wizard
 */

import chalk from 'chalk';
import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import ora from 'ora';
import path from 'path';

export interface PrerequisiteResult {
  name: string;
  passed: boolean;
  message: string;
  version?: string;
}

export interface SetupConfig {
  startDocker: boolean;
  generateEnv: boolean;
  envOverwrite: boolean;
  createUser: boolean;
  userPassword?: string;
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
 * Check if a Docker container is running
 */
export function isContainerRunning(containerName: string): boolean {
  try {
    const output = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().includes(containerName);
  } catch {
    return false;
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
 * Start Docker services using docker-compose
 * Only starts couchdb and elasticsearch (not the app service which requires building)
 */
export async function startDockerServices(rootDir: string): Promise<boolean> {
  const spinner = ora('Starting Docker services...').start();

  return new Promise((resolve) => {
    // Only start couchdb and elasticsearch, not the app service
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
 * Check if default user already exists by querying CouchDB directly
 */
export function checkDefaultUserExists(): boolean {
  try {
    // Quick check if user registry database exists and has the user
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
 * Creates the eddo_pi_agent user used by the eddo-todo skill for MCP access
 * Returns true if user was created or already exists
 * @param password - Optional custom password (defaults to 'eddo_pi_agent')
 */
export function createDefaultUser(rootDir: string, password?: string): boolean {
  const args = ['dev:create-user'];
  if (password) {
    args.push('--', '--password', password);
  }

  const result = spawnSync('pnpm', args, {
    cwd: rootDir,
    stdio: 'inherit', // Show output directly
    encoding: 'utf-8',
  });

  return result.status === 0;
}

/**
 * Generate minimal .env file for development
 */
export function generateEnvFile(rootDir: string, overwrite: boolean): boolean {
  const envPath = path.join(rootDir, '.env');

  if (fs.existsSync(envPath) && !overwrite) {
    console.log(chalk.yellow('  ⚠️  .env file already exists (use --force to overwrite)'));
    return false;
  }

  const minimalEnv = `# Eddo Development Environment
# Generated by pnpm setup on ${new Date().toISOString()}
# See .env.example for all available options

# CouchDB Configuration (matches docker-compose.yml defaults)
COUCHDB_URL=http://admin:password@localhost:5984
COUCHDB_DB_NAME=todos-dev

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info

# MCP Server (for telegram bot and external integrations)
MCP_SERVER_URL=http://localhost:3001/mcp

# ============================================
# Optional: Uncomment and configure as needed
# ============================================

# Telegram Bot (get token from @BotFather)
# TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
# ANTHROPIC_API_KEY=your_anthropic_api_key

# Bot Persona: butler, gtd_coach, zen_master
# BOT_PERSONA_ID=butler

# LLM Model (default: claude-sonnet-4-0)
# LLM_MODEL=claude-sonnet-4-0
`;

  fs.writeFileSync(envPath, minimalEnv);
  console.log(chalk.green('  ✓ Generated .env file with development defaults'));
  return true;
}

/**
 * Display final summary and next steps
 */
export function displaySummary(dockerStarted: boolean): void {
  console.log('\n' + chalk.bold.green('🎉 Setup complete!\n'));

  console.log(chalk.bold('Next steps:'));
  console.log('');
  console.log('  1. Start the development server:');
  console.log(chalk.cyan('     pnpm dev'));
  console.log('');
  console.log('  2. Open the app in your browser:');
  console.log(chalk.cyan('     http://localhost:3000'));
  console.log('');

  if (!dockerStarted) {
    console.log('  3. If you need to start Docker services manually:');
    console.log(chalk.cyan('     docker compose up -d'));
    console.log('');
  }

  console.log(chalk.gray('Troubleshooting? Run: pnpm dev:doctor'));
  console.log('');
}
