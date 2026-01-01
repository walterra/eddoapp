/**
 * Message handling utilities for the agent
 */
import type { BotContext } from '../../bot/bot.js';
import { BRIEFING_CONTENT_MARKER, RECAP_CONTENT_MARKER } from '../../constants/briefing.js';
import { logger } from '../../utils/logger.js';
import { convertToTelegramMarkdown } from '../../utils/markdown.js';

import type { ConversationalPart } from './types.js';

/**
 * Removes briefing/recap markers from text
 */
function stripMarkers(text: string): string {
  return text.replaceAll(BRIEFING_CONTENT_MARKER, '').replaceAll(RECAP_CONTENT_MARKER, '');
}

/**
 * Sends a message to Telegram with appropriate formatting
 */
async function sendTelegramMessage(
  telegramContext: BotContext,
  text: string,
  isMarkdown: boolean,
  iterationId: string,
): Promise<void> {
  const replyOptions = isMarkdown ? { parse_mode: 'Markdown' as const } : {};

  logger.debug('📤 Sending message to Telegram', {
    iterationId,
    parseMode: replyOptions.parse_mode || 'none',
    textLength: text.length,
  });

  await telegramContext.reply(text, replyOptions);

  logger.debug('✅ Message sent successfully to Telegram', {
    iterationId,
    parseMode: replyOptions.parse_mode || 'none',
  });
}

/**
 * Attempts to print content to thermal printer if enabled
 */
async function attemptPrint(
  telegramContext: BotContext,
  content: string,
  contentType: 'briefing' | 'recap',
  iterationId: string,
): Promise<void> {
  const userWantsPrinting = telegramContext.session?.user?.preferences?.printBriefing === true;

  logger.info('🔍 User print preference check', {
    iterationId,
    userId: telegramContext.from?.id?.toString(),
    printBriefing: telegramContext.session?.user?.preferences?.printBriefing,
    userWantsPrinting,
    contentType,
  });

  if (!userWantsPrinting) {
    logger.debug('🖨️ User has printing disabled, skipping print', {
      userId: telegramContext.from?.id?.toString(),
      contentType,
    });
    return;
  }

  try {
    const printerModule = await import('@eddo/printer-service');

    if (!printerModule.appConfig.PRINTER_ENABLED) {
      logger.debug('🖨️ Printer globally disabled (PRINTER_ENABLED=false)');
      return;
    }

    const userId = telegramContext.from?.id?.toString() || 'unknown';

    logger.info(`🖨️ Attempting to print ${contentType} to thermal printer`, {
      userId,
      iteration: iterationId,
      contentType,
    });

    const formattedContent = printerModule.formatBriefingForPrint(content);

    await printerModule.printBriefing({
      content: formattedContent,
      userId,
      timestamp: new Date().toISOString(),
      type: contentType,
    });

    logger.info(
      `✅ ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} printed successfully`,
    );
  } catch (printerError) {
    logger.error(`❌ Failed to print ${contentType} (non-fatal)`, {
      error: printerError instanceof Error ? printerError.message : String(printerError),
      contentType,
    });
  }
}

/**
 * Handles sending conversational content to Telegram and optional printing
 */
export async function handleConversationalMessage(
  telegramContext: BotContext,
  conversationalPart: ConversationalPart,
  iterationId: string,
): Promise<void> {
  const hasBriefingMarker = conversationalPart.text.includes(BRIEFING_CONTENT_MARKER);
  const hasRecapMarker = conversationalPart.text.includes(RECAP_CONTENT_MARKER);
  const textWithoutMarker = stripMarkers(conversationalPart.text);

  const textToSend = conversationalPart.isMarkdown
    ? convertToTelegramMarkdown(textWithoutMarker)
    : textWithoutMarker;

  try {
    await sendTelegramMessage(
      telegramContext,
      textToSend,
      conversationalPart.isMarkdown,
      iterationId,
    );

    // Handle printing for briefings/recaps
    if (hasBriefingMarker || hasRecapMarker) {
      const contentType = hasBriefingMarker ? 'briefing' : 'recap';
      logger.info(
        `🔍 ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} marker detected`,
        {
          iterationId,
          userId: telegramContext.from?.id?.toString(),
        },
      );
      await attemptPrint(telegramContext, textWithoutMarker, contentType, iterationId);
    }
  } catch (error) {
    logger.error('❌ Failed to send message to Telegram', {
      iterationId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    // Retry without markdown if markdown parsing failed
    if (conversationalPart.isMarkdown) {
      await retryWithoutMarkdown(telegramContext, conversationalPart.text, iterationId);
    }
  }
}

/**
 * Retries sending a message without markdown formatting
 */
async function retryWithoutMarkdown(
  telegramContext: BotContext,
  text: string,
  iterationId: string,
): Promise<void> {
  try {
    logger.debug('🔄 Retrying without markdown formatting', { iterationId });
    await telegramContext.reply(text);
    logger.debug('✅ Plain text message sent successfully', { iterationId });
  } catch (fallbackError) {
    logger.error('❌ Failed to send fallback message', {
      iterationId,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    });
  }
}
