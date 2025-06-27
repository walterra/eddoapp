#!/usr/bin/env tsx

/**
 * Manual test script for CLI functionality
 * Tests basic configuration and validation without actual backup
 */

import chalk from 'chalk';
import { getBackupConfig } from './backup-interactive.js';

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
  const helpProcess = spawn('tsx', ['scripts/backup-interactive.ts', '--help'], {
    stdio: 'inherit',
  });
  
  helpProcess.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('✅ Help command works'));
    } else {
      console.error(chalk.red('❌ Help command failed'));
    }
  });
}

// Parse command line arguments for test selection
const args = process.argv.slice(2);
const testConfig = args.includes('--config') || args.length === 0;
const testHelp = args.includes('--help-test') || args.length === 0;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(chalk.blue('🚀 CLI Testing Suite'));
  console.log(chalk.gray('Options: --config, --help-test, --no-interactive\n'));
  
  if (testConfig) {
    await testConfigGeneration();
  }
  
  if (testHelp) {
    await testCLIHelp();
  }
}