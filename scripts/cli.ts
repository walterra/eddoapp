#!/usr/bin/env tsx

/**
 * Unified CLI entry point for all EdDoApp scripts
 * Discovers and orchestrates available commands
 */

import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScriptInfo {
  name: string;
  description: string;
  file: string;
  hasInteractive: boolean;
}

// Available scripts configuration
const SCRIPTS: Record<string, ScriptInfo> = {
  backup: {
    name: 'backup',
    description: 'Backup CouchDB database',
    file: 'backup-interactive.ts',
    hasInteractive: true,
  },
  restore: {
    name: 'restore',
    description: 'Restore CouchDB database from backup',
    file: 'restore-interactive.ts',
    hasInteractive: true,
  },
  'verify-backup': {
    name: 'verify-backup',
    description: 'Verify integrity of backup files',
    file: 'verify-backup.ts',
    hasInteractive: false,
  },
  'populate-mock-data': {
    name: 'populate-mock-data',
    description: 'Populate database with mock data for testing',
    file: 'populate-mock-data.ts',
    hasInteractive: false,
  },
};

async function listAvailableScripts(): Promise<void> {
  console.log(chalk.blue('\n📋 Available EdDoApp Scripts\n'));
  
  Object.values(SCRIPTS).forEach((script) => {
    const status = fs.existsSync(path.join(__dirname, script.file)) ? '✅' : '❌';
    const interactive = script.hasInteractive ? chalk.gray('(interactive)') : '';
    console.log(`  ${status} ${chalk.cyan(script.name.padEnd(20))} ${script.description} ${interactive}`);
  });
  
  console.log('\nUsage:');
  console.log(`  ${chalk.gray('pnpm cli <script-name> [options]')}`);
  console.log(`  ${chalk.gray('pnpm cli                     # Interactive mode')}`);
  console.log(`  ${chalk.gray('pnpm cli --list              # List available scripts')}`);
}

async function runInteractiveMode(): Promise<void> {
  console.log(chalk.blue('\n🚀 EdDoApp CLI - Interactive Mode\n'));
  
  // Filter to only show existing scripts
  const availableScripts = Object.values(SCRIPTS).filter((script) =>
    fs.existsSync(path.join(__dirname, script.file))
  );

  if (availableScripts.length === 0) {
    console.log(chalk.red('No scripts found in the scripts directory.'));
    return;
  }

  const { selectedScript } = await prompts({
    type: 'select',
    name: 'selectedScript',
    message: 'Which script would you like to run?',
    choices: availableScripts.map((script) => ({
      title: `${script.name} - ${script.description}`,
      value: script.name,
      description: script.hasInteractive ? 'Supports interactive mode' : 'Command-line only',
    })),
  });

  if (!selectedScript) {
    console.log(chalk.red('\nNo script selected. Exiting.'));
    return;
  }

  await runScript(selectedScript, []);
}

async function runScript(scriptName: string, args: string[]): Promise<void> {
  const script = SCRIPTS[scriptName];
  
  if (!script) {
    console.error(chalk.red(`Unknown script: ${scriptName}`));
    console.log('\nAvailable scripts:');
    Object.keys(SCRIPTS).forEach((name) => {
      console.log(`  ${chalk.cyan(name)}`);
    });
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, script.file);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(chalk.red(`Script file not found: ${scriptPath}`));
    process.exit(1);
  }

  console.log(chalk.gray(`\nRunning: ${script.name}`));
  console.log(chalk.gray(`File: ${script.file}\n`));

  try {
    // Dynamic import and execution
    const module = await import(scriptPath);
    
    // Most scripts are designed to run when imported, but we can also
    // call specific functions if they export them
    if (scriptName === 'backup' && module.performBackup) {
      // Special handling for the interactive backup script
      const { spawn } = await import('child_process');
      const child = spawn('tsx', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      
      child.on('exit', (code) => {
        process.exit(code || 0);
      });
    } else {
      // For other scripts, spawn them as separate processes
      const { spawn } = await import('child_process');
      const child = spawn('tsx', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      
      child.on('exit', (code) => {
        process.exit(code || 0);
      });
    }
  } catch (error) {
    console.error(chalk.red('Failed to run script:'), error);
    process.exit(1);
  }
}

// CLI setup
const program = new Command();

program
  .name('cli')
  .description('EdDoApp unified CLI - Interactive script runner')
  .version('1.0.0')
  .option('-l, --list', 'list available scripts')
  .argument('[script]', 'script name to run')
  .argument('[args...]', 'arguments to pass to the script')
  .action(async (script, args, options) => {
    try {
      if (options.list) {
        await listAvailableScripts();
        return;
      }

      if (!script) {
        await runInteractiveMode();
        return;
      }

      await runScript(script, args);
    } catch (error) {
      console.error(chalk.red('CLI Error:'), error);
      process.exit(1);
    }
  });

// Handle help command specially
program.command('help [command]')
  .description('display help for command')
  .action(async (command) => {
    if (command && SCRIPTS[command]) {
      const script = SCRIPTS[command];
      console.log(chalk.blue(`\n${script.name} - ${script.description}\n`));
      
      // Run the script with --help to show its specific help
      const { spawn } = await import('child_process');
      const child = spawn('tsx', [path.join(__dirname, script.file), '--help'], {
        stdio: 'inherit',
      });
    } else {
      program.help();
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { runScript, listAvailableScripts };