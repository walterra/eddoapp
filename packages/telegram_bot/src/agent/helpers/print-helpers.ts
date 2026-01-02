/**
 * Print-related helper functions for briefing/recap content
 */
import type { BotContext } from '../../bot/bot.js';
import { logger } from '../../utils/logger.js';

interface PrinterModule {
  appConfig: { PRINTER_ENABLED: boolean };
  formatBriefingForPrint: (content: string) => string;
  printBriefing: (options: PrintOptions) => Promise<void>;
}

interface PrintOptions {
  content: string;
  userId: string;
  timestamp: string;
  type: 'briefing' | 'recap';
}

/**
 * Checks if user has printing enabled in preferences
 * @param ctx - Bot context
 * @returns True if user wants printing
 */
export function userWantsPrinting(ctx: BotContext): boolean {
  return ctx.session?.user?.preferences?.printBriefing === true;
}

/**
 * Logs user print preference check
 * @param ctx - Bot context
 * @param contentType - Type of content being printed
 * @param iterationId - Agent iteration ID
 */
export function logPrintPreferenceCheck(
  ctx: BotContext,
  contentType: 'briefing' | 'recap',
  iterationId: string,
): void {
  const wantsPrinting = userWantsPrinting(ctx);
  logger.info('🔍 User print preference check', {
    iterationId,
    userId: ctx.from?.id?.toString(),
    printBriefing: ctx.session?.user?.preferences?.printBriefing,
    userWantsPrinting: wantsPrinting,
    contentType,
  });
}

/**
 * Logs print disabled message
 * @param ctx - Bot context
 * @param contentType - Type of content
 */
export function logPrintDisabled(ctx: BotContext, contentType: 'briefing' | 'recap'): void {
  logger.debug('🖨️ User has printing disabled, skipping print', {
    userId: ctx.from?.id?.toString(),
    contentType,
  });
}

/**
 * Logs printer globally disabled
 */
export function logPrinterGloballyDisabled(): void {
  logger.debug('🖨️ Printer globally disabled (PRINTER_ENABLED=false)');
}

/**
 * Logs print attempt start
 * @param userId - User ID
 * @param iterationId - Agent iteration ID
 * @param contentType - Type of content
 */
export function logPrintAttempt(
  userId: string,
  iterationId: string,
  contentType: 'briefing' | 'recap',
): void {
  logger.info(`🖨️ Attempting to print ${contentType} to thermal printer`, {
    userId,
    iteration: iterationId,
    contentType,
  });
}

/**
 * Logs print success
 * @param contentType - Type of content printed
 */
export function logPrintSuccess(contentType: 'briefing' | 'recap'): void {
  const capitalizedType = contentType.charAt(0).toUpperCase() + contentType.slice(1);
  logger.info(`✅ ${capitalizedType} printed successfully`);
}

/**
 * Logs print failure
 * @param error - Error that occurred
 * @param contentType - Type of content
 */
export function logPrintError(error: unknown, contentType: 'briefing' | 'recap'): void {
  logger.error(`❌ Failed to print ${contentType} (non-fatal)`, {
    error: error instanceof Error ? error.message : String(error),
    contentType,
  });
}

/**
 * Executes the actual print operation
 * @param printerModule - Loaded printer module
 * @param content - Content to print
 * @param userId - User ID
 * @param contentType - Type of content
 */
export async function executePrint(
  printerModule: PrinterModule,
  content: string,
  userId: string,
  contentType: 'briefing' | 'recap',
): Promise<void> {
  const formattedContent = printerModule.formatBriefingForPrint(content);
  await printerModule.printBriefing({
    content: formattedContent,
    userId,
    timestamp: new Date().toISOString(),
    type: contentType,
  });
}
