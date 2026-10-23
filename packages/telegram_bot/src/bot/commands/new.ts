import { createAssistantConversationDatabase, createEnv } from '@eddo/core-server';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';

/** Selects a fresh active conversation without loading legacy model history. */
export async function handleNewConversation(ctx: BotContext): Promise<void> {
  const username = ctx.session.user?.username;
  if (!username) {
    await ctx.reply('Could not start a new conversation. Link your account first.');
    return;
  }
  try {
    const env = createEnv();
    const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
    await database.ensureDatabase();
    await database.setupDesignDocuments();
    const conversation = await database.startNewConversation();
    ctx.session.conversationId = conversation._id;
    ctx.session.lastBotMessage = undefined;
    await ctx.reply('Started a new conversation.');
  } catch (error) {
    logger.error('Failed to start new assistant conversation', { username, error });
    await ctx.reply('Could not start a new conversation. Try again.');
  }
}
