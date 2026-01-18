#!/usr/bin/env tsx

/**
 * Create default development user (eddo_pi_agent) directly in CouchDB
 * This user is used by the eddo-todo skill for MCP access via X-User-ID header
 *
 * Usage:
 *   pnpm dev:create-user                    # Uses default password
 *   pnpm dev:create-user --password mypass  # Uses custom password
 */

// Load .env file before importing modules that need env vars
import 'dotenv-mono/load';

import { createEnv, createUserRegistry } from '@eddo/core-server';
import { createDefaultUserPreferences } from '@eddo/core-shared';
import bcrypt from 'bcryptjs';
import chalk from 'chalk';

const SALT_ROUNDS = 12;
const DEFAULT_USERNAME = 'eddo_pi_agent';
const DEFAULT_EMAIL = 'eddo_pi_agent@localhost';
const DEFAULT_PASSWORD = 'eddo_pi_agent';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function parseArgs(): { password: string } {
  const args = process.argv.slice(2);
  let password = DEFAULT_PASSWORD;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    }
  }

  return { password };
}

async function createDefaultUser(password: string): Promise<boolean> {
  console.log(chalk.blue('\n📝 Creating default development user...\n'));

  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Check if user already exists
    const existingUser = await userRegistry.findByUsername(DEFAULT_USERNAME);
    if (existingUser) {
      console.log(chalk.green(`✓ User "${DEFAULT_USERNAME}" already exists`));
      return true;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in registry (this also creates the user database)
    const user = await userRegistry.create({
      username: DEFAULT_USERNAME,
      email: DEFAULT_EMAIL,
      password_hash: passwordHash,
      telegram_id: undefined,
      database_name: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      permissions: ['read', 'write'],
      status: 'active',
      version: 'alpha2',
      preferences: createDefaultUserPreferences(),
    });

    console.log(chalk.green(`✓ User "${DEFAULT_USERNAME}" created (ID: ${user._id})`));
    console.log(chalk.green('\n✅ Default user setup complete!\n'));
    console.log(chalk.gray(`  Username: ${DEFAULT_USERNAME}`));
    console.log(
      chalk.gray(
        `  Password: ${password === DEFAULT_PASSWORD ? DEFAULT_PASSWORD + ' (default)' : '(custom)'}`,
      ),
    );
    console.log(chalk.gray(`  Used by: eddo-todo skill (X-User-ID header)\n`));

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      console.log(chalk.red('\n❌ Could not connect to CouchDB'));
      console.log(chalk.yellow('  Make sure Docker services are running:'));
      console.log(chalk.cyan('    docker compose up -d couchdb elasticsearch\n'));
      return false;
    }

    console.error(chalk.red('\n❌ Failed to create default user:'), message);
    return false;
  }
}

// Run if executed directly
const { password } = parseArgs();
const success = await createDefaultUser(password);
process.exit(success ? 0 : 1);
