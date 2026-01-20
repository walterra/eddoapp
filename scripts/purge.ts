#!/usr/bin/env tsx

/**
 * Purge command - Reset development environment to fresh clone state
 *
 * WARNING: This is destructive! It will remove:
 * - Docker containers and volumes (all data!)
 * - Build artifacts (dist/, *.tsbuildinfo)
 * - Generated files (.env, logs/)
 *
 * By default, node_modules is preserved so scripts continue to work.
 *
 * Usage:
 *   pnpm dev:purge                    # Interactive confirmation
 *   pnpm dev:purge --force            # Skip confirmation (CI mode)
 *   pnpm dev:purge --dry-run          # Preview what would be deleted
 *   pnpm dev:purge --include-modules  # Also remove node_modules
 *   pnpm dev:purge --all              # Same as --include-modules
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

interface PurgeOptions {
  force: boolean;
  dryRun: boolean;
  includeModules: boolean;
}

function parseArgs(): PurgeOptions {
  const args = process.argv.slice(2);
  return {
    force:
      args.includes('--force') ||
      args.includes('-f') ||
      args.includes('--yes') ||
      args.includes('-y'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    // Default: keep node_modules. Use --include-modules to remove them too
    includeModules: args.includes('--include-modules') || args.includes('--all'),
  };
}

/** Execute command and return success status */
function exec(command: string, description: string, dryRun: boolean): boolean {
  if (dryRun) {
    console.log(chalk.gray(`  [dry-run] Would run: ${command}`));
    return true;
  }

  process.stdout.write(chalk.gray(`  ${description}...`));
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(chalk.green(' ✓'));
    return true;
  } catch {
    console.log(chalk.yellow(' (skipped)'));
    return false;
  }
}

/** Remove a file or directory */
function remove(targetPath: string, description: string, dryRun: boolean): boolean {
  const fullPath = path.join(ROOT_DIR, targetPath);

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  if (dryRun) {
    console.log(chalk.gray(`  [dry-run] Would remove: ${targetPath}`));
    return true;
  }

  process.stdout.write(chalk.gray(`  ${description}...`));
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(chalk.green(' ✓'));
    return true;
  } catch {
    console.log(chalk.red(' ✗'));
    return false;
  }
}

/** Find and remove files matching pattern */
function removeGlob(pattern: string, description: string, dryRun: boolean): number {
  let count = 0;

  // Find matching files/directories
  try {
    const result = execSync(
      `find . -name "${pattern}" -not -path "./node_modules/*" 2>/dev/null || true`,
      {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
      },
    );

    const paths = result.trim().split('\n').filter(Boolean);

    if (paths.length === 0) return 0;

    if (dryRun) {
      console.log(chalk.gray(`  [dry-run] Would remove ${paths.length} ${description}`));
      paths.forEach((p) => console.log(chalk.gray(`    - ${p}`)));
      return paths.length;
    }

    process.stdout.write(chalk.gray(`  Removing ${paths.length} ${description}...`));

    for (const p of paths) {
      const fullPath = path.join(ROOT_DIR, p);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        count++;
      }
    }

    console.log(chalk.green(` ✓ (${count} removed)`));
  } catch {
    console.log(chalk.yellow(' (skipped)'));
  }

  return count;
}

/** Stop and remove Docker containers and volumes */
function purgeDocker(dryRun: boolean): void {
  console.log(chalk.blue('\n🐳 Stopping Docker services...\n'));

  // Stop docker-compose services
  exec(
    'docker compose down --volumes --remove-orphans',
    'Stopping docker-compose services',
    dryRun,
  );

  // Remove eddo-specific containers (in case they're orphaned)
  exec(
    'docker rm -f eddo-couchdb eddo-elasticsearch eddo-app 2>/dev/null || true',
    'Removing eddo containers',
    dryRun,
  );

  // Remove chat session containers (eddo-chat-*)
  exec(
    'docker ps -aq --filter "name=eddo-chat-" | xargs -r docker rm -f 2>/dev/null || true',
    'Removing chat session containers',
    dryRun,
  );

  // Remove SearXNG container from skill
  exec('docker rm -f searxng 2>/dev/null || true', 'Removing SearXNG container', dryRun);

  // Remove eddo volumes
  exec(
    'docker volume rm eddo_couchdb_data eddo_elasticsearch_data 2>/dev/null || true',
    'Removing eddo volumes',
    dryRun,
  );

  // Remove Docker images
  exec(
    'docker rmi pi-coding-agent:latest 2>/dev/null || true',
    'Removing pi-coding-agent image',
    dryRun,
  );
  exec('docker rmi searxng/searxng:latest 2>/dev/null || true', 'Removing SearXNG image', dryRun);
}

/** Remove node_modules and build artifacts */
function purgeNodeArtifacts(dryRun: boolean, includeModules: boolean): void {
  console.log(chalk.blue('\n📦 Removing Node.js artifacts...\n'));

  if (includeModules) {
    // Root node_modules
    remove('node_modules', 'Removing root node_modules', dryRun);

    // Package node_modules
    const packages = [
      'packages/web-client',
      'packages/web-api',
      'packages/core-shared',
      'packages/core-server',
      'packages/core-client',
      'packages/core-instrumentation',
      'packages/mcp_server',
      'packages/telegram_bot',
      'packages/setup',
      'packages/chat-agent',
    ];

    for (const pkg of packages) {
      remove(`${pkg}/node_modules`, `Removing ${pkg}/node_modules`, dryRun);
    }

    // pnpm store (optional - can be large)
    remove('.pnpm-store', 'Removing local pnpm store', dryRun);
  } else {
    console.log(chalk.gray('  (keeping node_modules - use --include-modules to remove)\n'));
  }

  // Build artifacts (always remove)
  removeGlob('dist', 'dist directories', dryRun);
  removeGlob('*.tsbuildinfo', 'TypeScript build info files', dryRun);
}

/** Remove generated configuration and logs */
function purgeGeneratedFiles(dryRun: boolean): void {
  console.log(chalk.blue('\n🗑️  Removing generated files...\n'));

  remove('.env', 'Removing .env', dryRun);
  remove('logs', 'Removing logs directory', dryRun);
  remove('.eslintcache', 'Removing ESLint cache', dryRun);
  remove('.testcontainer-url', 'Removing testcontainer URL file', dryRun);

  // Vitest cache
  remove('node_modules/.vitest', 'Removing Vitest cache', dryRun);
  remove('.vitest', 'Removing Vitest cache', dryRun);
}

/** Print lines with consistent formatting */
function printLines(lines: string[]): void {
  lines.forEach((line) => console.log(line));
}

/** Display what will be removed */
function displayWarning(includeModules: boolean): void {
  console.log(chalk.red.bold('\n⚠️  WARNING: DESTRUCTIVE OPERATION ⚠️\n'));
  console.log(chalk.yellow('This will permanently delete:\n'));

  printLines([
    chalk.white('  🐳 Docker:'),
    chalk.gray('     - All eddo containers (couchdb, elasticsearch, app)'),
    chalk.gray('     - Chat session containers (eddo-chat-*)'),
    chalk.gray('     - SearXNG container (from skill)'),
    chalk.gray('     - All eddo volumes (YOUR DATA WILL BE LOST!)'),
    chalk.gray('     - Docker images (pi-coding-agent, searxng)'),
    chalk.yellow('     ⚠ Uses wildcard patterns - may affect similarly named containers'),
    '',
  ]);

  const nodeLines = includeModules
    ? [
        chalk.gray('     - All node_modules directories'),
        chalk.gray('     - All dist/ build outputs'),
        chalk.gray('     - TypeScript build cache (*.tsbuildinfo)'),
      ]
    : [
        chalk.gray('     - All dist/ build outputs'),
        chalk.gray('     - TypeScript build cache (*.tsbuildinfo)'),
        chalk.green('     - (keeping node_modules)'),
      ];
  printLines([chalk.white('  📦 Node.js:'), ...nodeLines, '']);

  printLines([
    chalk.white('  🗑️  Generated files:'),
    chalk.gray('     - .env configuration'),
    chalk.gray('     - logs/ directory'),
    chalk.gray('     - Various caches (.eslintcache, .vitest, etc.)'),
    '',
  ]);

  const restoreLines = includeModules
    ? [chalk.white('  pnpm install'), chalk.white('  pnpm dev:setup')]
    : [chalk.white('  pnpm dev:setup')];
  printLines([chalk.cyan('After purge, you will need to run:'), ...restoreLines, '']);

  printLines([
    chalk.yellow('  ⚠ Browser data (PouchDB/IndexedDB) is NOT cleared by this script.'),
    chalk.gray('    To fully reset, also clear browser site data for localhost:3000'),
    chalk.gray('    (DevTools → Application → Storage → Clear site data)'),
    '',
  ]);
}

async function confirmPurge(): Promise<boolean> {
  // First confirmation
  const { confirm1 } = await prompts({
    type: 'confirm',
    name: 'confirm1',
    message: chalk.red('Are you sure you want to purge everything?'),
    initial: false,
  });

  if (!confirm1) return false;

  // Type confirmation for extra safety
  const { confirm2 } = await prompts({
    type: 'text',
    name: 'confirm2',
    message: chalk.red('Type "PURGE" to confirm:'),
  });

  return confirm2 === 'PURGE';
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log(chalk.bold.red('\n🔥 Eddo Development Environment Purge\n'));

  displayWarning(options.includeModules);

  if (options.dryRun) {
    console.log(chalk.cyan.bold('🔍 DRY RUN MODE - No changes will be made\n'));
  }

  // Confirm unless --force
  if (!options.force && !options.dryRun) {
    const confirmed = await confirmPurge();
    if (!confirmed) {
      console.log(chalk.yellow('\n❌ Purge cancelled.\n'));
      process.exit(0);
    }
  }

  console.log(chalk.red.bold('\n🔥 Starting purge...\n'));

  // Execute purge operations
  purgeDocker(options.dryRun);
  purgeNodeArtifacts(options.dryRun, options.includeModules);
  purgeGeneratedFiles(options.dryRun);

  // Summary
  if (options.dryRun) {
    console.log(chalk.cyan.bold('\n✅ Dry run complete. No changes were made.\n'));
    console.log(chalk.gray('Run without --dry-run to actually purge.\n'));
  } else {
    console.log(chalk.green.bold('\n✅ Purge complete!\n'));
    console.log(chalk.white('To restore your development environment:\n'));
    if (options.includeModules) {
      console.log(chalk.cyan('  pnpm install'));
    }
    console.log(chalk.cyan('  pnpm dev:setup'));
    console.log('');
    console.log(chalk.yellow('⚠ Note: Browser data (PouchDB) was not cleared.'));
    console.log(
      chalk.gray('  To fully reset, clear site data in your browser for localhost:3000\n'),
    );
  }
}

main().catch((error) => {
  console.error(chalk.red('\nPurge failed:'), error.message);
  process.exit(1);
});
