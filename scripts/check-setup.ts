#!/usr/bin/env tsx

/**
 * Pre-flight check for development environment.
 * Exits with error if setup hasn't been completed.
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dirname, '..');

function checkSetup(): boolean {
  const envPath = path.join(rootDir, '.env');

  if (!fs.existsSync(envPath)) {
    console.error(chalk.red('\n❌ Setup required!\n'));
    console.error(chalk.yellow('  The .env file is missing. Please run setup first:\n'));
    console.error(chalk.cyan('    pnpm dev:setup\n'));
    console.error(chalk.gray('  This will:'));
    console.error(chalk.gray('    • Generate .env with development defaults'));
    console.error(chalk.gray('    • Start Docker services (CouchDB)'));
    console.error(chalk.gray('    • Create the default development user\n'));
    return false;
  }

  return true;
}

const isSetup = checkSetup();
process.exit(isSetup ? 0 : 1);
