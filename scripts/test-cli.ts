#!/usr/bin/env tsx

/**
 * Manual test script for CLI functionality
 * Tests basic configuration and validation without actual backup
 */

import chalk from 'chalk';
import { getBackupConfig } from './backup-interactive.js';
import { validateEnv, getAvailableDatabases } from '@eddo/shared/config';

async function testDatabaseDiscovery(): Promise<void> {
  console.log(chalk.blue('\n🧪 Testing Database Discovery\n'));

  try {
    const env = validateEnv(process.env);
    console.log(chalk.cyan('Discovering available databases...'));
    
    const databases = await getAvailableDatabases(env);
    
    if (databases.length === 0) {
      console.log(chalk.yellow('⚠️  No databases found or unable to connect to CouchDB'));
      console.log(chalk.gray('Make sure CouchDB is running and accessible'));
    } else {
      console.log(chalk.green(`✅ Found ${databases.length} database(s):`));
      databases.forEach((db, index) => {
        console.log(`   ${index + 1}. ${chalk.cyan(db)}`);
      });
    }
  } catch (error) {
    console.error(chalk.red('❌ Database discovery test failed:'), error);
  }
}

async function testConfigGeneration(): Promise<void> {
  console.log(chalk.blue('\n🧪 Testing CLI Configuration Generation\n'));

  try {
    // Test 1: Full configuration provided
    console.log(chalk.cyan('Test 1: Full configuration provided'));
    const fullConfig = await getBackupConfig({
      database: 'test-db',
      backupDir: './test-backups',
      parallelism: 3,
      timeout: 30000,
      dryRun: true,
    });
    
    console.log('✅ Full config test passed');
    console.log(`   Database: ${fullConfig.database}`);
    console.log(`   Backup Dir: ${fullConfig.backupDir}`);
    console.log(`   Parallelism: ${fullConfig.parallelism}`);
    console.log(`   Timeout: ${fullConfig.timeout}`);
    console.log(`   Dry Run: ${fullConfig.dryRun}`);

    // Test 2: Partial configuration (this will prompt interactively)
    console.log(chalk.cyan('\nTest 2: Interactive mode (will prompt)'));
    console.log(chalk.gray('Run with --no-interactive to skip this test'));
    
    if (!process.argv.includes('--no-interactive')) {
      const interactiveConfig = await getBackupConfig({
        database: 'interactive-test',
      });
      console.log('✅ Interactive config test completed');
      console.log(`   Final config: ${JSON.stringify(interactiveConfig, null, 2)}`);
    } else {
      console.log('⏭️  Interactive test skipped');
    }

    console.log(chalk.green('\n✅ All CLI tests passed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

async function testCLIHelp(): Promise<void> {
  console.log(chalk.blue('\n🧪 Testing CLI Help Output\n'));
  
  const { spawn } = await import('child_process');
  
  console.log(chalk.cyan('Testing backup-interactive --help:'));
  const backupHelpProcess = spawn('tsx', ['scripts/backup-interactive.ts', '--help'], {
    stdio: 'inherit',
  });
  
  backupHelpProcess.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('✅ Backup help command works'));
    } else {
      console.error(chalk.red('❌ Backup help command failed'));
    }
  });

  console.log(chalk.cyan('\nTesting restore-interactive --help:'));
  const restoreHelpProcess = spawn('tsx', ['scripts/restore-interactive.ts', '--help'], {
    stdio: 'inherit',
  });
  
  restoreHelpProcess.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('✅ Restore help command works'));
    } else {
      console.error(chalk.red('❌ Restore help command failed'));
    }
  });
}

// Parse command line arguments for test selection
const args = process.argv.slice(2);
const testDatabase = args.includes('--database') || args.length === 0;
const testConfig = args.includes('--config') || args.length === 0;
const testHelp = args.includes('--help-test') || args.length === 0;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(chalk.blue('🚀 CLI Testing Suite'));
  console.log(chalk.gray('Options: --database, --config, --help-test, --no-interactive\n'));
  
  if (testDatabase) {
    await testDatabaseDiscovery();
  }
  
  if (testConfig) {
    await testConfigGeneration();
  }
  
  if (testHelp) {
    await testCLIHelp();
  }
}