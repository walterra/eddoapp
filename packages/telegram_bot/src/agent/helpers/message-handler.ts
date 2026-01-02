/**
 * Message handling utilities for the agent
 */
import type { BotContext } from '../../bot/bot.js';
import { BRIEFING_CONTENT_MARKER, RECAP_CONTENT_MARKER } from '../../constants/briefing.js';
import { logger } from '../../utils/logger.js';
import { convertToTelegramMarkdown } from '../../utils/markdown.js';

import {
  executePrint,
  logPrintAttempt,
  logPrintDisabled,
  logPrinterGloballyDisabled,
  logPrintError,
  logPrintPreferenceCheck,
  logPrintSuccess,
  userWantsPrinting,
} from './print-helpers.js';
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
  ctx: BotContext,
  content: string,
  contentType: 'briefing' | 'recap',
  iterationId: string,
): Promise<void> {
  logPrintPreferenceCheck(ctx, contentType, iterationId);

  if (!userWantsPrinting(ctx)) {
    logPrintDisabled(ctx, contentType);
    return;
  }

  try {
    const printerModule = await import('@eddo/printer-service');

    if (!printerModule.appConfig.PRINTER_ENABLED) {
      logPrinterGloballyDisabled();
      return;
    }

    const userId = ctx.from?.id?.toString() || 'unknown';
    logPrintAttempt(userId, iterationId, contentType);

    await executePrint(printerModule, content, userId, contentType);
    logPrintSuccess(contentType);
  } catch (printerError) {
    logPrintError(printerError, contentType);
  }
}

function detectContentType(text: string): 'briefing' | 'recap' | null {
  if (text.includes(BRIEFING_CONTENT_MARKER)) return 'briefing';
  if (text.includes(RECAP_CONTENT_MARKER)) return 'recap';
  return null;
}

function formatTextForSend(text: string, isMarkdown: boolean): string {
  const stripped = stripMarkers(text);
  return isMarkdown ? convertToTelegramMarkdown(stripped) : stripped;
}

async function handlePrintIfNeeded(
  ctx: BotContext,
  text: string,
  contentType: 'briefing' | 'recap' | null,
  iterationId: string,
): Promise<void> {
  if (!contentType) return;

  const capitalizedType = contentType.charAt(0).toUpperCase() + contentType.slice(1);
  logger.info(`🔍 ${capitalizedType} marker detected`, {
    iterationId,
    userId: ctx.from?.id?.toString(),
  });
  await attemptPrint(ctx, stripMarkers(text), contentType, iterationId);
}

function logSendError(error: unknown, iterationId: string): void {
  logger.error('❌ Failed to send message to Telegram', {
    iterationId,
    error: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  });
}

/**
 * Handles sending conversational content to Telegram and optional printing
 */
export async function handleConversationalMessage(
  telegramContext: BotContext,
  conversationalPart: ConversationalPart,
  iterationId: string,
): Promise<void> {
  const contentType = detectContentType(conversationalPart.text);
  const textToSend = formatTextForSend(conversationalPart.text, conversationalPart.isMarkdown);

  try {
    await sendTelegramMessage(
      telegramContext,
      textToSend,
      conversationalPart.isMarkdown,
      iterationId,
    );
    await handlePrintIfNeeded(telegramContext, conversationalPart.text, contentType, iterationId);
  } catch (error) {
    logSendError(error, iterationId);
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
