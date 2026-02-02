#!/usr/bin/env node
/**
 * Interactive self-host deployment wizard
 */
import chalk from 'chalk';
import { execSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prompts, { PromptObject } from 'prompts';
import { fileURLToPath } from 'url';
import { waitForService } from './docker.js';
import { checkPrerequisites, displayPrerequisites, isDockerRunning } from './prerequisites.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SELF_HOST_DIR = path.join(ROOT_DIR, 'self-host');
const ENV_PATH = path.join(SELF_HOST_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(SELF_HOST_DIR, '.env.example');
interface DeployOptions {
  ci?: boolean;
  force?: boolean;
}
interface EnvValues {
  EDDO_VERSION: string;
  NODE_ENV: string;
  LOG_LEVEL: string;
  PORT: string;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  COUCHDB_ADMIN_USERNAME: string;
  COUCHDB_ADMIN_PASSWORD: string;
  COUCHDB_DB_NAME: string;
  COUCHDB_URL: string;
  ELASTICSEARCH_URL: string;
  MCP_SERVER_URL: string;
  MCP_SERVER_PORT: string;
  MCP_HOST: string;
  TELEGRAM_BOT_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  BOT_PERSONA_ID: string;
  LLM_MODEL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_API_KEY?: string;
}
interface DeployConfig {
  generateEnv: boolean;
  envOverwrite: boolean;
  envValues: EnvValues;
}
function parseArgs(): DeployOptions {
  const args = process.argv.slice(2);
  return {
    ci: args.includes('--ci') || args.includes('-y') || args.includes('--yes'),
    force: args.includes('--force') || args.includes('-f'),
  };
}
function getDefaultEnvValues(): EnvValues {
  const adminUser = 'admin';
  const adminPassword = 'password';
  return {
    EDDO_VERSION: 'latest',
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    PORT: '3000',
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: generateJwtSecret(),
    COUCHDB_ADMIN_USERNAME: adminUser,
    COUCHDB_ADMIN_PASSWORD: adminPassword,
    COUCHDB_DB_NAME: 'todos-prod',
    COUCHDB_URL: `http://${adminUser}:${adminPassword}@eddo-couchdb:5984`,
    ELASTICSEARCH_URL: 'http://eddo-elasticsearch:9200',
    MCP_SERVER_URL: 'http://eddo-mcp-server:3001/mcp',
    MCP_SERVER_PORT: '3001',
    MCP_HOST: '0.0.0.0',
    TELEGRAM_BOT_TOKEN: '',
    ANTHROPIC_API_KEY: '',
    BOT_PERSONA_ID: 'butler',
    LLM_MODEL: 'claude-sonnet-4-0',
  };
}
function generateJwtSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
function ensureSelfHostDir(): void {
  if (!fs.existsSync(SELF_HOST_DIR)) {
    throw new Error('self-host directory not found. Run from repo root.');
  }
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error('self-host/.env.example not found.');
  }
}
function readEnvTemplate(): string {
  return fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
}
function setEnvValue(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}
function writeEnvFile(values: EnvValues): void {
  let content = readEnvTemplate();
  const derivedCouchUrl = `http://${values.COUCHDB_ADMIN_USERNAME}:${values.COUCHDB_ADMIN_PASSWORD}@eddo-couchdb:5984`;
  const mergedValues = { ...values, COUCHDB_URL: derivedCouchUrl };
  for (const [key, value] of Object.entries(mergedValues)) {
    if (value === undefined) continue;
    content = setEnvValue(content, key, value);
  }
  fs.writeFileSync(ENV_PATH, content);
  console.log(chalk.green('  ✓ Wrote self-host/.env'));
}
const ENV_PROMPT_BUILDERS: Array<(defaults: EnvValues) => PromptObject> = [
  (defaults) => ({
    type: 'text',
    name: 'EDDO_VERSION',
    message: 'Docker image tag (EDDO_VERSION)?',
    initial: defaults.EDDO_VERSION,
  }),
  () => ({
    type: 'password',
    name: 'JWT_SECRET',
    message: 'JWT secret (32+ chars, leave empty to generate):',
  }),
  (defaults) => ({
    type: 'text',
    name: 'TELEGRAM_BOT_TOKEN',
    message: 'Telegram bot token:',
    initial: defaults.TELEGRAM_BOT_TOKEN,
  }),
  (defaults) => ({
    type: 'password',
    name: 'ANTHROPIC_API_KEY',
    message: 'Anthropic API key:',
    initial: defaults.ANTHROPIC_API_KEY,
  }),
  (defaults) => ({
    type: 'text',
    name: 'COUCHDB_ADMIN_USERNAME',
    message: 'CouchDB admin username:',
    initial: defaults.COUCHDB_ADMIN_USERNAME,
  }),
  (defaults) => ({
    type: 'password',
    name: 'COUCHDB_ADMIN_PASSWORD',
    message: 'CouchDB admin password:',
    initial: defaults.COUCHDB_ADMIN_PASSWORD,
  }),
  (defaults) => ({
    type: 'text',
    name: 'COUCHDB_DB_NAME',
    message: 'CouchDB database name:',
    initial: defaults.COUCHDB_DB_NAME,
  }),
  (defaults) => ({
    type: 'text',
    name: 'CORS_ORIGIN',
    message: 'CORS origin:',
    initial: defaults.CORS_ORIGIN,
  }),
];
function buildEnvPrompts(defaults: EnvValues): PromptObject[] {
  return ENV_PROMPT_BUILDERS.map((builder) => builder(defaults));
}
async function promptEnvValues(defaults: EnvValues): Promise<EnvValues> {
  const responses = await prompts(buildEnvPrompts(defaults));
  return {
    ...defaults,
    ...responses,
    JWT_SECRET: responses.JWT_SECRET || defaults.JWT_SECRET,
  };
}
async function promptEnvConfig(
  envExists: boolean,
): Promise<{ generate: boolean; overwrite: boolean }> {
  if (!envExists) {
    const { generateEnv } = await prompts({
      type: 'confirm',
      name: 'generateEnv',
      message: 'Create self-host/.env from template?',
      initial: true,
    });
    return { generate: generateEnv, overwrite: false };
  }
  const { overwriteEnv } = await prompts({
    type: 'confirm',
    name: 'overwriteEnv',
    message: 'self-host/.env exists. Overwrite?',
    initial: false,
  });
  return { generate: overwriteEnv, overwrite: overwriteEnv };
}
function startCompose(): boolean {
  const result = spawnSync('docker', ['compose', '-f', 'docker-compose.yml', 'up', '-d'], {
    cwd: SELF_HOST_DIR,
    stdio: 'inherit',
  });
  return result.status === 0;
}
function isServiceHealthy(url: string): boolean {
  try {
    execSync(`curl -sf ${url}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}
async function runHealthChecks(): Promise<boolean> {
  const checks = [
    { name: 'CouchDB', url: 'http://localhost:5984/_up' },
    { name: 'Elasticsearch', url: 'http://localhost:9222/_cluster/health' },
    { name: 'Web API', url: 'http://localhost:3000/health' },
    { name: 'MCP Server', url: 'http://localhost:3001/mcp' },
  ];
  const results = await Promise.all(
    checks.map((check) => waitForService(check.name, () => isServiceHealthy(check.url))),
  );
  return results.every(Boolean);
}
function displayDeploySummary(success: boolean): void {
  if (!success) {
    console.log(chalk.bold.red('\n❌ Deploy incomplete - check logs and configuration.\n'));
    return;
  }
  console.log(chalk.bold.green('\n🎉 Self-host deploy complete!\n'));
  console.log(chalk.bold('Services:'));
  console.log(chalk.cyan('  Web app: http://localhost:3000'));
  console.log(chalk.cyan('  MCP server: http://localhost:3001/mcp'));
  console.log(chalk.cyan('  CouchDB: http://localhost:5984'));
  console.log(chalk.cyan('  Elasticsearch: http://localhost:9222'));
  console.log('');
}
async function getConfig(options: DeployOptions, envExists: boolean): Promise<DeployConfig> {
  const defaults = getDefaultEnvValues();
  if (options.ci) {
    return {
      generateEnv: !envExists || options.force === true,
      envOverwrite: options.force === true,
      envValues: defaults,
    };
  }
  const envConfig = await promptEnvConfig(envExists);
  const envValues = envConfig.generate ? await promptEnvValues(defaults) : defaults;
  return {
    generateEnv: envConfig.generate,
    envOverwrite: envConfig.overwrite,
    envValues,
  };
}
async function main(): Promise<void> {
  const options = parseArgs();
  console.log(chalk.bold.blue('\n🚀 Eddo Self-host Deploy (local)\n'));
  ensureSelfHostDir();
  const prerequisites = checkPrerequisites();
  const allPrerequisitesPassed = displayPrerequisites(prerequisites);
  if (!allPrerequisitesPassed) {
    const criticalFailed = prerequisites.some(
      (p) => !p.passed && ['Node.js', 'pnpm', 'Docker', 'Docker Daemon'].includes(p.name),
    );
    if (criticalFailed) {
      console.log(chalk.red('❌ Please install missing prerequisites before continuing.'));
      process.exit(1);
    }
  }
  if (!isDockerRunning()) {
    console.log(chalk.red('❌ Docker daemon not running. Start Docker Desktop and retry.'));
    process.exit(1);
  }
  const envExists = fs.existsSync(ENV_PATH);
  const config = await getConfig(options, envExists);
  if (config.generateEnv) {
    if (envExists && !config.envOverwrite) {
      console.log(chalk.yellow('  ⚠️  self-host/.env exists (use --force to overwrite)'));
    } else {
      writeEnvFile(config.envValues);
    }
  }
  console.log(chalk.blue('\n🐳 Starting Docker Compose...\n'));
  const started = startCompose();
  if (!started) {
    console.log(chalk.red('❌ Failed to start Docker Compose.'));
    process.exit(1);
  }
  const healthOk = await runHealthChecks();
  displayDeploySummary(healthOk);
  if (!healthOk) {
    process.exit(1);
  }
}
main().catch((error) => {
  console.error(chalk.red('Deploy failed:'), error.message);
  process.exit(1);
});
