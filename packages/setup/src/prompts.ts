/**
 * Interactive prompts for setup wizard
 */

import chalk from 'chalk';
import prompts from 'prompts';

import type { EddoSkillsStatus } from './pi-skills.js';
import type { SetupConfig } from './types.js';
import { checkDefaultUserExists } from './workspace.js';

/** Prompt for Docker services */
async function promptDockerServices(servicesRunning: boolean): Promise<boolean> {
  if (servicesRunning) return false;
  const { startDocker } = await prompts({
    type: 'confirm',
    name: 'startDocker',
    message: 'Start Docker services (CouchDB + Elasticsearch)?',
    initial: true,
  });
  return startDocker;
}

/** Prompt for .env file generation */
async function promptEnvFile(
  envExists: boolean,
): Promise<{ generate: boolean; overwrite: boolean }> {
  if (!envExists) {
    const { generateEnv } = await prompts({
      type: 'confirm',
      name: 'generateEnv',
      message: 'Generate .env file with development defaults?',
      initial: true,
    });
    return { generate: generateEnv, overwrite: false };
  }

  const { overwriteEnv } = await prompts({
    type: 'confirm',
    name: 'overwriteEnv',
    message: '.env exists. Overwrite with fresh defaults?',
    initial: false,
  });
  return { generate: overwriteEnv, overwrite: overwriteEnv };
}

/** Prompt for default user creation */
async function promptUserCreation(
  userExists: boolean,
): Promise<{ create: boolean; password?: string }> {
  if (userExists) {
    console.log(chalk.green('  ✓ User eddo_pi_agent already exists\n'));
    return { create: false };
  }

  console.log(chalk.gray('  ℹ️  The eddo_pi_agent user is required for MCP/agentic access.'));
  console.log(
    chalk.gray('     In this version, it is the only user capable of AI agent integration.\n'),
  );

  const { createUser } = await prompts({
    type: 'confirm',
    name: 'createUser',
    message: 'Create eddo_pi_agent user?',
    initial: true,
  });

  if (!createUser) return { create: false };

  const { userPassword } = await prompts({
    type: 'password',
    name: 'userPassword',
    message: 'Password for eddo_pi_agent (leave empty for default):',
  });

  return { create: true, password: userPassword || undefined };
}

/** Prompt for pi-coding-agent Docker image build */
async function promptAgentImageBuild(imageExists: boolean): Promise<boolean> {
  if (imageExists) return false;

  console.log(
    chalk.gray('  ℹ️  The pi-coding-agent Docker image is required for the Chat feature.'),
  );
  console.log(chalk.gray('     This builds a container for running AI coding agents.\n'));

  const { buildImage } = await prompts({
    type: 'confirm',
    name: 'buildImage',
    message: 'Build pi-coding-agent Docker image? (required for Chat)',
    initial: true,
  });
  return buildImage;
}

/** Prompt for installing eddo skills/extensions to pi-coding-agent */
async function promptPiSkillsInstall(
  piInstalled: boolean,
  skillsStatus: EddoSkillsStatus,
): Promise<boolean> {
  if (!piInstalled) return false;

  const availableSkills = skillsStatus.skills.filter((s) => s.status === 'not_installed');
  const availableExts = skillsStatus.extensions.filter((e) => e.status === 'not_installed');
  const hasConflicts = skillsStatus.conflicts.length > 0;

  if (availableSkills.length === 0 && availableExts.length === 0 && !hasConflicts) {
    return false;
  }

  console.log(chalk.gray('  ℹ️  Eddo provides skills and extensions for pi-coding-agent:'));
  if (availableSkills.length > 0) {
    console.log(chalk.gray(`     Skills: ${availableSkills.map((s) => s.name).join(', ')}`));
  }
  if (availableExts.length > 0) {
    console.log(chalk.gray(`     Extensions: ${availableExts.map((e) => e.name).join(', ')}`));
  }
  if (hasConflicts) {
    console.log(
      chalk.yellow(
        `     ⚠ ${skillsStatus.conflicts.length} conflict(s) detected - will be skipped`,
      ),
    );
  }
  console.log(chalk.gray('     These enable AI-assisted todo management and visualizations.\n'));

  const { installSkills } = await prompts({
    type: 'confirm',
    name: 'installSkills',
    message: 'Link Eddo skills/extensions to pi-coding-agent?',
    initial: true,
  });
  return installSkills;
}

export interface PromptOptions {
  servicesRunning: boolean;
  envExists: boolean;
  agentImageExists: boolean;
  piStatus: { installed: boolean; skillsStatus: EddoSkillsStatus };
  isDockerRunning: boolean;
}

/**
 * Prompt user for all setup options (interactive mode)
 */
export async function promptForOptions(options: PromptOptions): Promise<SetupConfig> {
  const { servicesRunning, envExists, agentImageExists, piStatus, isDockerRunning } = options;
  const startDocker = await promptDockerServices(servicesRunning);
  const envConfig = await promptEnvFile(envExists);

  let userConfig: { create: boolean; password: string | undefined } = {
    create: false,
    password: undefined,
  };
  if (servicesRunning || startDocker) {
    const userExists = servicesRunning && checkDefaultUserExists();
    const result = await promptUserCreation(userExists);
    userConfig = { create: result.create, password: result.password };
  }

  let buildAgentImage = false;
  if ((servicesRunning || startDocker) && isDockerRunning) {
    buildAgentImage = await promptAgentImageBuild(agentImageExists);
  }

  const installPiSkills = await promptPiSkillsInstall(piStatus.installed, piStatus.skillsStatus);

  return {
    startDocker,
    generateEnv: envConfig.generate,
    envOverwrite: envConfig.overwrite,
    createUser: userConfig.create,
    userPassword: userConfig.password,
    buildAgentImage,
    installPiSkills,
  };
}

/**
 * Get default config for CI mode (non-interactive)
 */
export function getCiConfig(
  servicesRunning: boolean,
  envExists: boolean,
  piInstalled: boolean,
  force: boolean,
): SetupConfig {
  return {
    startDocker: !servicesRunning,
    generateEnv: !envExists || force,
    envOverwrite: force,
    createUser: true,
    userPassword: undefined,
    buildAgentImage: false, // Skip in CI to save time
    installPiSkills: piInstalled,
  };
}
