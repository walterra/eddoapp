/**
 * Display utilities for setup wizard
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { isContainerRunning, isPiCodingAgentImageExists } from './docker.js';
import {
  checkEddoSkillsInstalled,
  isPiCodingAgentInstalled,
  type EddoSkillsStatus,
  type SkillInfo,
} from './pi-skills.js';

/**
 * Display Docker services status
 */
export function displayDockerStatus(): {
  couchdb: boolean;
  elasticsearch: boolean;
  agentImage: boolean;
} {
  const services = {
    couchdb: isContainerRunning('eddo-couchdb'),
    elasticsearch: isContainerRunning('eddo-elasticsearch'),
    agentImage: isPiCodingAgentImageExists(),
  };

  console.log(chalk.bold('📦 Docker Services Status:\n'));
  console.log(
    `  ${services.couchdb ? chalk.green('✓') : chalk.yellow('○')} CouchDB: ${services.couchdb ? 'running' : 'not running'}`,
  );
  console.log(
    `  ${services.elasticsearch ? chalk.green('✓') : chalk.yellow('○')} Elasticsearch: ${services.elasticsearch ? 'running' : 'not running'}`,
  );
  console.log(
    `  ${services.agentImage ? chalk.green('✓') : chalk.yellow('○')} pi-coding-agent image: ${services.agentImage ? 'built' : 'not built'} ${chalk.gray('(for Chat feature)')}`,
  );
  console.log('');

  return services;
}

/**
 * Display configuration status
 */
export function displayConfigStatus(rootDir: string): boolean {
  const envExists = fs.existsSync(path.join(rootDir, '.env'));

  console.log(chalk.bold('📄 Configuration:\n'));
  console.log(
    `  ${envExists ? chalk.green('✓') : chalk.yellow('○')} .env file: ${envExists ? 'exists' : 'not found'}`,
  );
  console.log('');

  return envExists;
}

/** Check if item has a conflict status */
function hasConflict(item: SkillInfo): boolean {
  return item.status === 'linked_different' || item.status === 'exists_directory';
}

/** Display skills/extensions status lines */
function displaySkillsExtensionsStatus(skillsStatus: EddoSkillsStatus): void {
  const linkedSkills = skillsStatus.skills.filter((s) => s.status === 'linked_correct');
  const availableSkills = skillsStatus.skills.filter((s) => s.status === 'not_installed');
  const conflictSkills = skillsStatus.skills.filter(hasConflict);

  const linkedExts = skillsStatus.extensions.filter((e) => e.status === 'linked_correct');
  const availableExts = skillsStatus.extensions.filter((e) => e.status === 'not_installed');
  const conflictExts = skillsStatus.extensions.filter(hasConflict);

  if (linkedSkills.length > 0) {
    console.log(chalk.green(`  ✓ Skills linked: ${linkedSkills.map((s) => s.name).join(', ')}`));
  }
  if (availableSkills.length > 0) {
    console.log(
      chalk.yellow(`  ○ Skills available: ${availableSkills.map((s) => s.name).join(', ')}`),
    );
  }
  if (conflictSkills.length > 0) {
    console.log(
      chalk.red(`  ⚠ Skills with conflicts: ${conflictSkills.map((s) => s.name).join(', ')}`),
    );
  }
  if (linkedExts.length > 0) {
    console.log(chalk.green(`  ✓ Extensions linked: ${linkedExts.map((e) => e.name).join(', ')}`));
  }
  if (availableExts.length > 0) {
    console.log(
      chalk.yellow(`  ○ Extensions available: ${availableExts.map((e) => e.name).join(', ')}`),
    );
  }
  if (conflictExts.length > 0) {
    console.log(
      chalk.red(`  ⚠ Extensions with conflicts: ${conflictExts.map((e) => e.name).join(', ')}`),
    );
  }
}

/**
 * Display pi-coding-agent status
 */
export function displayPiCodingAgentStatus(rootDir: string): {
  installed: boolean;
  version?: string;
  skillsStatus: EddoSkillsStatus;
} {
  const piStatus = isPiCodingAgentInstalled();
  const skillsStatus = checkEddoSkillsInstalled(rootDir);

  console.log(chalk.bold('🤖 pi-coding-agent Integration:\n'));

  if (piStatus.installed) {
    console.log(chalk.green(`  ✓ pi-coding-agent ${piStatus.version} installed globally`));
    displaySkillsExtensionsStatus(skillsStatus);
  } else {
    console.log(chalk.yellow('  ○ pi-coding-agent not installed'));
    console.log(chalk.gray('    Install with: npm install -g @mariozechner/pi-coding-agent'));
  }

  console.log('');

  return { installed: piStatus.installed, version: piStatus.version, skillsStatus };
}

/**
 * Display final summary and next steps
 */
export function displaySummary(success: boolean, piInstalled: boolean = false): void {
  if (!success) {
    console.log('\n' + chalk.bold.red('❌ Setup incomplete - some steps failed.\n'));
    console.log(chalk.gray('Troubleshooting? Run: pnpm doctor'));
    console.log('');
    return;
  }

  console.log('\n' + chalk.bold.green('🎉 Setup complete!\n'));

  console.log(chalk.bold('Next steps:'));
  console.log('');
  console.log('  1. Start the development server:');
  console.log(chalk.cyan('     pnpm dev'));
  console.log('');
  console.log('  2. Open the app in your browser:');
  console.log(chalk.cyan('     http://localhost:3000'));
  console.log('');

  if (!piInstalled) {
    console.log(chalk.bold('Optional - pi-coding-agent integration:'));
    console.log('');
    console.log('  Install pi-coding-agent for AI-assisted development:');
    console.log(chalk.cyan('     npm install -g @mariozechner/pi-coding-agent'));
    console.log('');
    console.log('  Then re-run setup to install Eddo skills:');
    console.log(chalk.cyan('     pnpm setup'));
    console.log('');
  }

  console.log(chalk.gray('Troubleshooting? Run: pnpm doctor'));
  console.log('');
}
