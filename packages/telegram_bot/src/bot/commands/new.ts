import { createAssistantChatHistoryStore } from '../../agent/chat-history-store.js';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';

/** Handles /new by starting a fresh active assistant conversation. */
export async function handleNewConversation(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;

  try {
    const conversation = await createAssistantChatHistoryStore().startNewConversation(ctx);
    if (!conversation) {
      await ctx.reply('Could not start a new conversation. Link your account first.');
      return;
    }

    ctx.session.conversationId = conversation.conversationId;
    ctx.session.lastBotMessage = undefined;
    await ctx.reply('Started a new conversation.');
  } catch (error) {
    logger.error('Failed to start new assistant conversation', { userId, error });
    await ctx.reply('Could not start a new conversation. Try again.');
  }
}
