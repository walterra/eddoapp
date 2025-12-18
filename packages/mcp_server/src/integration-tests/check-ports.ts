#!/usr/bin/env tsx
/**
 * Pre-test port availability checker
 */
import { checkPortAvailable } from './setup/port-check.js';

async function main() {
  const testPort = parseInt(process.env.MCP_TEST_PORT || '3003', 10);

  console.log(`Checking if port ${testPort} is available for tests...`);

  const isAvailable = await checkPortAvailable(testPort);

  if (isAvailable) {
    console.log(`✅ Port ${testPort} is available`);
    process.exit(0);
  } else {
    console.error(`\n❌ Port ${testPort} is already in use!`);
    console.error(`\nPlease stop any running MCP servers before running tests.`);
    console.error(`You can check what's using the port with: lsof -i :${testPort}`);
    console.error(`\nCommon causes:`);
    console.error(`- A previous test run didn't clean up properly`);
    console.error(`- You have an MCP server running in another terminal`);
    console.error(`- Another application is using this port`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error checking ports:', error);
  process.exit(1);
});
