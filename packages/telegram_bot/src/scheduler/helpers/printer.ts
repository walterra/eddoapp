/**
 * Thermal printer integration for scheduled briefings/recaps
 */
import { logger } from '../../utils/logger.js';

interface PrintOptions {
  userId: string;
  username?: string;
  content: string;
  type: 'briefing' | 'recap';
}

/**
 * Attempts to print content to thermal printer if enabled
 */
export async function printIfEnabled(options: PrintOptions): Promise<void> {
  const { userId, content, type } = options;

  try {
    const printerModule = await import('@eddo/printer-service');

    if (!printerModule.appConfig.PRINTER_ENABLED) {
      logger.debug('🖨️ Printer globally disabled (PRINTER_ENABLED=false)');
      return;
    }

    logger.info(`🖨️ Printing scheduled ${type} to thermal printer`, {
      userId,
      username: options.username,
    });

    const formattedContent = printerModule.formatBriefingForPrint(content);

    await printerModule.printBriefing({
      content: formattedContent,
      userId,
      timestamp: new Date().toISOString(),
      type,
    });

    logger.info(`✅ Scheduled ${type} printed successfully`);
  } catch (printerError) {
    logger.error(`❌ Failed to print scheduled ${type} (non-fatal)`, {
      error: printerError instanceof Error ? printerError.message : String(printerError),
    });
  }
}
