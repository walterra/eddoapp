#!/usr/bin/env node
import { Command } from 'commander';
import {
  printBriefing,
  printTestPage,
  testConnection,
} from './printer/client.js';
import { formatBriefingForPrint } from './printer/formatter.js';
import { appConfig } from './utils/config.js';

const program = new Command();

program
  .name('printer')
  .description('Eddo Printer Service CLI')
  .version('0.1.0');

/**
 * Test printer connection
 */
program
  .command('test-connection')
  .description('Test connection to Epson TM-m30III printer')
  .action(async () => {
    console.log('Testing printer connection...');
    console.log(`IP Address: ${appConfig.PRINTER_IP_ADDRESS || 'NOT SET'}`);
    console.log(`Port: ${appConfig.PRINTER_PORT}`);
    console.log('');

    const result = await testConnection();

    if (result.connected) {
      console.log('✅ Printer connected successfully!');
      if (result.printerInfo) {
        console.log('');
        console.log('Printer Information:');
        console.log(`  Type: ${result.printerInfo.type}`);
        console.log(
          `  Address: ${result.printerInfo.ipAddress}:${result.printerInfo.port}`,
        );
      }
    } else {
      console.error('❌ Printer connection failed');
      console.error(`Error: ${result.error}`);

      // Only exit with error code if it's a real connection failure, not just missing config
      if (result.error !== 'Printer IP address not configured') {
        process.exit(1);
      }
    }
  });

/**
 * Print test page
 */
program
  .command('test-page')
  .description('Print a test page to verify printer functionality')
  .action(async () => {
    console.log('Printing test page...');

    try {
      await printTestPage();
      console.log('✅ Test page sent to printer successfully');
    } catch (error) {
      console.error('❌ Failed to print test page');
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

/**
 * Print briefing for a user
 */
program
  .command('print-briefing')
  .description('Print daily briefing for a specific user')
  .requiredOption('-u, --user <userId>', 'User ID to print briefing for')
  .option('-c, --content <content>', 'Briefing content (for testing)')
  .action(async (options) => {
    console.log(`Printing briefing for user: ${options.user}`);

    try {
      // For now, use sample content if not provided
      const sampleBriefing =
        options.content ||
        `
🌅 Good morning! Here's your daily briefing:

**📅 Today's Tasks** (3)
• 15:00 Doctor appointment
• Review project proposal
• Buy groceries

**⚠️ Overdue** (2)
• Fix authentication bug
• Submit expense report

**✅ Next Actions** (5)
• Call client about contract
• Update documentation
• Review pull request
• Test printer integration
• Deploy to production

**⏳ Active Time Tracking** (1)
• Working on: Printer service implementation (Started 2h ago)

Have a productive day!
`;

      const formattedContent = formatBriefingForPrint(sampleBriefing);

      await printBriefing({
        content: formattedContent,
        userId: options.user,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Briefing sent to printer successfully');
    } catch (error) {
      console.error('❌ Failed to print briefing');
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

/**
 * Show printer status and configuration
 */
program
  .command('status')
  .description('Show printer configuration and connection status')
  .action(async () => {
    console.log('Printer Service Configuration:');
    console.log('================================');
    console.log(`Enabled: ${appConfig.PRINTER_ENABLED ? 'Yes' : 'No'}`);
    console.log(`IP Address: ${appConfig.PRINTER_IP_ADDRESS || 'NOT SET'}`);
    console.log(`Port: ${appConfig.PRINTER_PORT}`);
    console.log(`Schedule Time: ${appConfig.PRINTER_SCHEDULE_TIME}`);
    console.log('');

    if (!appConfig.PRINTER_ENABLED) {
      console.log('⚠️  Printer service is disabled');
      console.log('Set PRINTER_ENABLED=true in .env to enable');
      return;
    }

    if (!appConfig.PRINTER_IP_ADDRESS) {
      console.log('⚠️  Printer IP address not configured');
      console.log('Set PRINTER_IP_ADDRESS in .env');
      return;
    }

    console.log('Testing connection...');
    const result = await testConnection();

    if (result.connected) {
      console.log('✅ Printer is connected and ready');
    } else {
      console.log('❌ Printer connection failed');
      console.log(`Error: ${result.error}`);
    }
  });

program.parse();
