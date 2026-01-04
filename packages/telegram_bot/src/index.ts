// Note: OTEL auto-instrumentation is loaded via --import flag in package.json dev script
// See: node --import @elastic/opentelemetry-node --import tsx src/index.ts

// Configure global HTTP timeout for MCP requests (2 minutes)
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ bodyTimeout: 120_000, headersTimeout: 120_000 }));

import { createBot, type BotContext } from './bot/bot.js';
import { handleBriefing, handleBriefingOff, handleBriefingOn } from './bot/commands/briefing.js';
import { handleEmail } from './bot/commands/email.js';
import { handleGithub } from './bot/commands/github.js';
import { handleLink, handleUnlink } from './bot/commands/link.js';
import { handleRss } from './bot/commands/rss.js';
import { handleHelp, handleStart, handleStatus } from './bot/commands/start.js';
import { handleMessage } from './bot/handlers/message.js';
import { getMCPClient, setupMCPIntegration } from './mcp/client.js';
import { createDailyBriefingScheduler } from './scheduler/daily-briefing.js';
import { appConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

// Global references for cleanup
let globalScheduler: ReturnType<typeof createDailyBriefingScheduler> | null = null;

import { Bot } from 'grammy';

/**
 * Register all bot command handlers
 */
function registerCommandHandlers(bot: Bot<BotContext>): void {
  // Basic commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('status', handleStatus);
  bot.command('link', handleLink);
  bot.command('unlink', handleUnlink);

  // Briefing commands
  bot.command('briefing', handleBriefing);
  bot.command('briefing_on', handleBriefingOn);
  bot.command('briefing_off', handleBriefingOff);

  // Sync commands
  bot.command('github', handleGithub);
  bot.command('rss', handleRss);
  bot.command('email', handleEmail);

  // Message handler for agent workflow
  bot.on('message:text', handleMessage);
}

/**
 * Initialize MCP integration
 */
async function initializeMCP(): Promise<void> {
  logger.info('Initializing MCP integration...');
  const mcpClient = await setupMCPIntegration();
  logger.info('✅ MCP integration initialized successfully', {
    toolsAvailable: mcpClient.tools.length,
    toolNames: mcpClient.tools.map((t) => t.name),
  });
}

/**
 * Initialize and start the daily briefing scheduler
 */
function initializeScheduler(bot: Bot<BotContext>): void {
  logger.info('Initializing daily briefing scheduler...');
  const dailyBriefingScheduler = createDailyBriefingScheduler({
    bot,
    checkIntervalMs: 60 * 1000,
  });

  dailyBriefingScheduler.start();
  globalScheduler = dailyBriefingScheduler;
  logger.info('✅ Daily briefing scheduler started', { checkInterval: '60s' });
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Eddo Telegram Bot', {
    nodeEnv: appConfig.NODE_ENV,
    logLevel: appConfig.LOG_LEVEL,
  });

  try {
    await initializeMCP();

    const bot = createBot();
    registerCommandHandlers(bot);

    bot.catch((err) => {
      logger.error('Bot error occurred', { error: err.error, context: err.ctx });
    });

    initializeScheduler(bot);

    logger.info('Starting bot polling...');
    bot.start();

    logger.info('🎩 Eddo Bot is now running and ready to serve!');
    logger.info('📡 Connect your Telegram bot and start chatting!');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

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
}

// Handle graceful shutdown
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});
