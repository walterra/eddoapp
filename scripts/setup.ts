#!/usr/bin/env tsx

/**
 * Interactive setup wizard for Eddo development environment
 * Checks prerequisites, starts Docker services, and generates .env file
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';

import {
  checkVersionedPrerequisite,
  displayPrerequisites,
  displaySummary,
  generateEnvFile,
  isContainerRunning,
  isCouchDBHealthy,
  isDockerRunning,
  isElasticsearchHealthy,
  type PrerequisiteResult,
  type SetupConfig,
  startDockerServices,
  waitForService,
} from './setup-helpers.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

/**
 * Check all prerequisites
 */
function checkPrerequisites(): PrerequisiteResult[] {
  const results: PrerequisiteResult[] = [];

  // Node.js
  results.push(
    checkVersionedPrerequisite('Node.js', 'node', '18.11.0', 'Install from https://nodejs.org/'),
  );

  // pnpm
  results.push(
    checkVersionedPrerequisite('pnpm', 'pnpm', '7.1.0', 'Install with: npm install -g pnpm'),
  );

  // Docker
  results.push(
    checkVersionedPrerequisite(
      'Docker',
      'docker',
      '20.0.0',
      'Install from https://www.docker.com/products/docker-desktop/',
    ),
  );

  // Docker daemon check
  const dockerRunning = isDockerRunning();
  results.push({
    name: 'Docker Daemon',
    passed: dockerRunning,
    message: dockerRunning
      ? 'Docker daemon is running'
      : 'Docker daemon not running. Start Docker Desktop or run: sudo systemctl start docker',
  });

  // Git
  results.push(
    checkVersionedPrerequisite('Git', 'git', '2.0.0', 'Install from https://git-scm.com/'),
  );

  return results;
}

/**
 * Display Docker services status
 */
function displayDockerStatus(): { couchdb: boolean; elasticsearch: boolean } {
  const services = {
    couchdb: isContainerRunning('eddo-couchdb'),
    elasticsearch: isContainerRunning('eddo-elasticsearch'),
  };

  console.log(chalk.bold('📦 Docker Services Status:\n'));
  console.log(
    `  ${services.couchdb ? chalk.green('✓') : chalk.yellow('○')} CouchDB: ${services.couchdb ? 'running' : 'not running'}`,
  );
  console.log(
    `  ${services.elasticsearch ? chalk.green('✓') : chalk.yellow('○')} Elasticsearch: ${services.elasticsearch ? 'running' : 'not running'}`,
  );
  console.log('');

  return services;
}

/**
 * Display configuration status
 */
function displayConfigStatus(): boolean {
  const envExists = fs.existsSync(path.join(ROOT_DIR, '.env'));

  console.log(chalk.bold('📄 Configuration:\n'));
  console.log(
    `  ${envExists ? chalk.green('✓') : chalk.yellow('○')} .env file: ${envExists ? 'exists' : 'not found'}`,
  );
  console.log('');

  return envExists;
}

/**
 * Prompt user for setup options
 */
async function promptForOptions(
  servicesRunning: boolean,
  envExists: boolean,
): Promise<SetupConfig> {
  const config: SetupConfig = {
    startDocker: false,
    generateEnv: false,
    envOverwrite: false,
  };

  if (!servicesRunning) {
    const { startDocker } = await prompts({
      type: 'confirm',
      name: 'startDocker',
      message: 'Start Docker services (CouchDB + Elasticsearch)?',
      initial: true,
    });
    config.startDocker = startDocker;
  }

  if (!envExists) {
    const { generateEnv } = await prompts({
      type: 'confirm',
      name: 'generateEnv',
      message: 'Generate .env file with development defaults?',
      initial: true,
    });
    config.generateEnv = generateEnv;
  } else {
    const { overwriteEnv } = await prompts({
      type: 'confirm',
      name: 'overwriteEnv',
      message: '.env exists. Overwrite with fresh defaults?',
      initial: false,
    });
    config.generateEnv = overwriteEnv;
    config.envOverwrite = overwriteEnv;
  }

  return config;
}

/**
 * Execute setup based on config
 */
async function executeSetup(config: SetupConfig, servicesRunning: boolean): Promise<boolean> {
  let dockerStarted = servicesRunning;

  if (config.startDocker) {
    const started = await startDockerServices(ROOT_DIR);
    if (started) {
      await waitForService('CouchDB', isCouchDBHealthy);
      await waitForService('Elasticsearch', isElasticsearchHealthy);
      dockerStarted = true;
    }
  }

  if (config.generateEnv) {
    generateEnvFile(ROOT_DIR, config.envOverwrite);
  }

  return dockerStarted;
}

/**
 * Main setup wizard
 */
async function main(): Promise<void> {
  console.log(chalk.bold.blue('\n🚀 Eddo Development Setup\n'));
  console.log(chalk.gray('This wizard will help you set up your development environment.\n'));

  // Check prerequisites
  const prerequisites = checkPrerequisites();
  const allPrerequisitesPassed = displayPrerequisites(prerequisites);

  if (!allPrerequisitesPassed) {
    const criticalFailed = prerequisites.some(
      (p) => !p.passed && ['Node.js', 'pnpm', 'Docker'].includes(p.name),
    );

    if (criticalFailed) {
      console.log(chalk.red('❌ Please install missing prerequisites before continuing.\n'));
      process.exit(1);
    }
  }

  // Check current status
  const services = displayDockerStatus();
  const servicesRunning = services.couchdb && services.elasticsearch;
  const envExists = displayConfigStatus();

  // Get user options
  const config = await promptForOptions(servicesRunning, envExists);
  console.log('');

  // Execute setup
  const dockerStarted = await executeSetup(config, servicesRunning);

  // Display summary
  displaySummary(dockerStarted);
}

// Run the setup wizard
main().catch((error) => {
  console.error(chalk.red('Setup failed:'), error.message);
  process.exit(1);
});
