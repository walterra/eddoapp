import { createBot } from './bot/bot.js';
import { handleStart, handleHelp, handleStatus } from './bot/commands/start.js';
import { handleMessage } from './bot/handlers/message.js';
import { logger } from './utils/logger.js';
import { appConfig } from './utils/config.js';
import { getMCPClient } from './mcp/client.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Eddo Telegram Bot', {
    nodeEnv: appConfig.NODE_ENV,
    logLevel: appConfig.LOG_LEVEL,
  });

  try {
    // Initialize MCP client
    logger.info('Initializing MCP client...');
    const mcpClient = getMCPClient();
    
    try {
      await mcpClient.connect();
      logger.info('✅ MCP client connected successfully');
    } catch (mcpError) {
      logger.warn('⚠️ MCP client connection failed, will retry as needed', { error: mcpError });
      // Continue starting the bot even if MCP is not immediately available
    }

    // Create bot instance
    const bot = createBot();

    // Register command handlers
    bot.command('start', handleStart);
    bot.command('help', handleHelp);
    bot.command('status', handleStatus);

    // Register message handler for general text
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
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});
