#!/usr/bin/env tsx
/**
 * One-time cleanup utility for leftover test databases
 * This script cleans up test databases that were created by tests but not properly cleaned up
 */

import { cleanupDatabasesByPattern, getCouchDbConfig, validateEnv } from '@eddo/core-server';

async function main() {
  console.log('🧹 Cleaning up leftover test databases...');

  try {
    // Use test environment configuration
    const env = validateEnv(process.env);
    const _testCouchConfig = getCouchDbConfig(env);

    // Clean up databases with test- prefix
    const testDatabasePattern = /^test-/;
    const result = await cleanupDatabasesByPattern(testDatabasePattern, {
      env,
      dryRun: false,
      verbose: true,
      force: true, // Force cleanup for test databases
    });

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`  Total databases analyzed: ${result.summary.total}`);
    console.log(`  Cleaned up: ${result.summary.cleaned}`);
    console.log(`  Skipped: ${result.summary.skipped}`);
    console.log(`  Errors: ${result.summary.errors}`);

    if (result.errors.length > 0) {
      console.warn(`\n⚠️  Some databases could not be cleaned up:`);
      result.errors.forEach((error) => {
        console.warn(`  - ${error.database}: ${error.error}`);
      });
    }

    if (result.summary.cleaned > 0) {
      console.log(
        `\n✅ Successfully cleaned up ${result.summary.cleaned} leftover test databases.`,
      );
    } else {
      console.log(`\n✅ No leftover test databases found to clean up.`);
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main();
