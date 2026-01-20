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

    const installedSkills = skillsStatus.skills.filter((s) => s.installed);
    const notInstalledSkills = skillsStatus.skills.filter((s) => !s.installed);
    const installedExts = skillsStatus.extensions.filter((e) => e.installed);
    const notInstalledExts = skillsStatus.extensions.filter((e) => !e.installed);

    if (installedSkills.length > 0) {
      console.log(
        chalk.green(`  ✓ Skills linked: ${installedSkills.map((s) => s.name).join(', ')}`),
      );
    }
    if (notInstalledSkills.length > 0) {
      console.log(
        chalk.yellow(`  ○ Skills available: ${notInstalledSkills.map((s) => s.name).join(', ')}`),
      );
    }
    if (installedExts.length > 0) {
      console.log(
        chalk.green(`  ✓ Extensions linked: ${installedExts.map((e) => e.name).join(', ')}`),
      );
    }
    if (notInstalledExts.length > 0) {
      console.log(
        chalk.yellow(`  ○ Extensions available: ${notInstalledExts.map((e) => e.name).join(', ')}`),
      );
    }
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
