import { createBot } from './bot/bot.js';
import { handleBriefing, handleBriefingOff, handleBriefingOn } from './bot/commands/briefing.js';
import { handleGithub } from './bot/commands/github.js';
import { handleLink, handleUnlink } from './bot/commands/link.js';
import { handleHelp, handleStart, handleStatus } from './bot/commands/start.js';
import { handleMessage } from './bot/handlers/message.js';
import { getMCPClient, setupMCPIntegration } from './mcp/client.js';
import { createDailyBriefingScheduler } from './scheduler/daily-briefing.js';
import { appConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

// Global references for cleanup
let globalScheduler: ReturnType<typeof createDailyBriefingScheduler> | null = null;

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Eddo Telegram Bot', {
    nodeEnv: appConfig.NODE_ENV,
    logLevel: appConfig.LOG_LEVEL,
  });

  try {
    // Initialize MCP integration (eager initialization at startup)
    logger.info('Initializing MCP integration...');
    const mcpClient = await setupMCPIntegration();
    logger.info('✅ MCP integration initialized successfully', {
      toolsAvailable: mcpClient.tools.length,
      toolNames: mcpClient.tools.map((t) => t.name),
    });

    // Create bot instance
    const bot = createBot();

    // Register command handlers
    bot.command('start', handleStart);
    bot.command('help', handleHelp);
    bot.command('status', handleStatus);
    bot.command('link', handleLink);
    bot.command('unlink', handleUnlink);

    // Register briefing commands
    bot.command('briefing', handleBriefing);
    bot.command('briefing_on', handleBriefingOn); // Legacy compatibility
    bot.command('briefing_off', handleBriefingOff); // Legacy compatibility

    // Register GitHub sync commands
    bot.command('github', handleGithub);

    // Register message handler for general text with agent workflow
    bot.on('message:text', handleMessage);

    // Handle bot errors
    bot.catch((err) => {
      logger.error('Bot error occurred', {
        error: err.error,
        context: err.ctx,
      });
    });

    // Start the bot
    // Initialize and start daily briefing scheduler BEFORE starting bot polling
    logger.info('Initializing daily briefing scheduler...');
    const dailyBriefingScheduler = createDailyBriefingScheduler({
      bot,
      checkIntervalMs: 60 * 1000, // Check every minute
    });

    dailyBriefingScheduler.start();
    globalScheduler = dailyBriefingScheduler; // Store for cleanup
    logger.info('✅ Daily briefing scheduler started', {
      checkInterval: '60s',
    });

    logger.info('Starting bot polling...');
    bot.start(); // Don't await - let it run in background

    logger.info('🎩 Eddo Bot is now running and ready to serve!');
    logger.info('📡 Connect your Telegram bot and start chatting!');
    logger.info('🌅 Daily briefings will be sent at user-preferred times to opted-in users');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');

  // Stop scheduler
  if (globalScheduler) {
    globalScheduler.stop();
    logger.info('Daily briefing scheduler stopped');
  }

  const mcpClient = getMCPClient();
  if (mcpClient) {
    try {
      await mcpClient.close();
      logger.info('MCP connection closed successfully');
    } catch (error) {
      logger.error('Error closing MCP connection', { error });
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');

  // Stop scheduler
  if (globalScheduler) {
    globalScheduler.stop();
    logger.info('Daily briefing scheduler stopped');
  }

  const mcpClient = getMCPClient();
  if (mcpClient) {
    try {
      await mcpClient.close();
      logger.info('MCP connection closed successfully');
    } catch (error) {
      logger.error('Error closing MCP connection', { error });
    }
  }
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});
