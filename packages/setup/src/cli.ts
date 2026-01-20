#!/usr/bin/env node

/**
 * Interactive setup wizard for Eddo development environment
 */

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  displayConfigStatus,
  displayDockerStatus,
  displayPiCodingAgentStatus,
  displaySummary,
} from './display.js';
import {
  buildPiCodingAgentImage,
  isCouchDBHealthy,
  isElasticsearchHealthy,
  startDockerServices,
  waitForService,
} from './docker.js';
import { generateEnvFile } from './env.js';
import { installEddoSkillsAndExtensions } from './pi-skills.js';
import { checkPrerequisites, displayPrerequisites, isDockerRunning } from './prerequisites.js';
import { getCiConfig, promptForOptions } from './prompts.js';
import type { SetupConfig, SetupOptions } from './types.js';
import { buildWorkspacePackages, createDefaultUser, ensureLogsDirectory } from './workspace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');

function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  return {
    ci: args.includes('--ci') || args.includes('-y') || args.includes('--yes'),
    force: args.includes('--force') || args.includes('-f'),
  };
}

async function startAndWaitForDocker(rootDir: string): Promise<boolean> {
  const started = await startDockerServices(rootDir);
  if (!started) return false;
  await waitForService('CouchDB', isCouchDBHealthy);
  await waitForService('Elasticsearch', isElasticsearchHealthy);
  return true;
}

async function executeSetup(
  config: SetupConfig,
  rootDir: string,
  servicesRunning: boolean,
): Promise<boolean> {
  const dockerStarted = config.startDocker ? await startAndWaitForDocker(rootDir) : servicesRunning;

  if (config.generateEnv) generateEnvFile(rootDir, config.envOverwrite);

  ensureLogsDirectory(rootDir);
  buildWorkspacePackages(rootDir);

  const userCreated =
    dockerStarted && config.createUser ? createDefaultUser(rootDir, config.userPassword) : true;

  const imageBuilt = config.buildAgentImage ? buildPiCodingAgentImage(rootDir) : true;

  let skillsInstalled = true;
  if (config.installPiSkills) {
    console.log(chalk.blue('\n🔗 Linking Eddo skills and extensions to pi-coding-agent...\n'));
    skillsInstalled = installEddoSkillsAndExtensions(rootDir);
  }

  return dockerStarted && userCreated && imageBuilt && skillsInstalled;
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log(chalk.bold.blue('\n🚀 Eddo Development Setup\n'));

  console.log(chalk.yellow.bold('  ⚠️  ALPHA SOFTWARE - LOCAL DEVELOPMENT ONLY'));
  console.log(chalk.yellow('  Not ready for production. Do not deploy to servers.'));
  console.log(chalk.yellow('  No security hardening. Data integrity not guaranteed.\n'));

  if (options.ci) {
    console.log(chalk.gray('Running in CI mode (non-interactive)\n'));
  } else {
    console.log(
      chalk.gray('This wizard will help you set up your local development environment.\n'),
    );
  }

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
  const envExists = displayConfigStatus(ROOT_DIR);
  const piStatus = displayPiCodingAgentStatus(ROOT_DIR);

  // Get config (interactive or CI)
  const config = options.ci
    ? getCiConfig(servicesRunning, envExists, piStatus.installed, options.force ?? false)
    : await promptForOptions({
        servicesRunning,
        envExists,
        agentImageExists: services.agentImage,
        piStatus,
        isDockerRunning: isDockerRunning(),
      });

  console.log('');

  // Execute setup
  const success = await executeSetup(config, ROOT_DIR, servicesRunning);

  // Display summary
  displaySummary(success, piStatus.installed);

  if (!success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Setup failed:'), error.message);
  process.exit(1);
});
