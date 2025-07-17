import { createBot } from './bot/bot.js';
import { handleLink, handleUnlink } from './bot/commands/link.js';
import { handleHelp, handleStart, handleStatus } from './bot/commands/start.js';
import { handleMessage } from './bot/handlers/message.js';
import { getMCPClient, setupMCPIntegration } from './mcp/client.js';
import { appConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

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
    logger.info('Starting bot polling...');
    await bot.start();

    logger.info('🎩 Eddo Bot is now running and ready to serve!');
    logger.info('📡 Connect your Telegram bot and start chatting!');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
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
