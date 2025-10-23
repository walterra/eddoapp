import {
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from 'node-thermal-printer';
import { appConfig } from '../utils/config.js';

/**
 * Printer connection result
 */
export interface PrinterConnectionResult {
  connected: boolean;
  error?: string;
  printerInfo?: {
    ipAddress: string;
    port: number;
    type: string;
  };
}

/**
 * Print job options
 */
export interface PrintOptions {
  content: string;
  userId?: string;
  timestamp?: string;
  type?: 'briefing' | 'recap';
}

/**
 * Create a thermal printer instance
 */
export function createPrinterInstance(): ThermalPrinter {
  if (!appConfig.PRINTER_IP_ADDRESS) {
    throw new Error('PRINTER_IP_ADDRESS is not configured');
  }

  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${appConfig.PRINTER_IP_ADDRESS}:${appConfig.PRINTER_PORT}`,
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false,
    lineCharacter: '=',
    options: {
      timeout: 5000,
    },
  });
}

/**
 * Test printer connection
 * Uses library's built-in 5-second timeout (configured in createPrinterInstance)
 */
export async function testConnection(): Promise<PrinterConnectionResult> {
  let printer: ThermalPrinter | null = null;

  try {
    if (!appConfig.PRINTER_IP_ADDRESS) {
      return {
        connected: false,
        error: 'Printer IP address not configured',
      };
    }

    printer = createPrinterInstance();
    const isConnected = await printer.isPrinterConnected();

    if (!isConnected) {
      return {
        connected: false,
        error: 'Printer not responding',
      };
    }

    return {
      connected: true,
      printerInfo: {
        ipAddress: appConfig.PRINTER_IP_ADDRESS,
        port: appConfig.PRINTER_PORT,
        type: 'Epson TM-m30III',
      },
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (printer) {
      printer.clear();
    }
  }
}

/**
 * Print a test page
 */
export async function printTestPage(): Promise<void> {
  const printer = createPrinterInstance();
  const PRINT_TIMEOUT = 10000; // 10 seconds
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Print operation timed out')),
        PRINT_TIMEOUT,
      );
    });

    const printPromise = async () => {
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer not connected');
      }

      // Build test page
      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println('EDDO PRINTER TEST');
      printer.bold(false);
      printer.setTextNormal();

      printer.drawLine();

      printer.alignLeft();
      printer.println(`Date: ${new Date().toLocaleString()}`);
      printer.println(
        `Printer: ${appConfig.PRINTER_IP_ADDRESS}:${appConfig.PRINTER_PORT}`,
      );

      printer.drawLine();

      printer.println('');
      printer.alignCenter();
      printer.println('Test page printed successfully!');
      printer.println('');

      // QR code for test
      await printer.printQR('https://github.com/walterra/eddoapp', {
        cellSize: 6,
        correction: 'M',
        model: 2,
      });

      printer.newLine();
      printer.cut();

      await printer.execute();
      console.log('Test page printed successfully');
    };

    await Promise.race([printPromise(), timeoutPromise]);
  } catch (error) {
    console.error('Failed to print test page:', error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    printer.clear();
  }
}

/**
 * Print briefing content
 */
export async function printBriefing(options: PrintOptions): Promise<void> {
  const printer = createPrinterInstance();
  const PRINT_TIMEOUT = 10000; // 10 seconds
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Print operation timed out')),
        PRINT_TIMEOUT,
      );
    });

    const printPromise = async () => {
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer not connected');
      }

      // Header
      const headerText =
        options.type === 'recap' ? 'DAILY RECAP' : 'DAILY BRIEFING';
      const footerText =
        options.type === 'recap'
          ? 'Eddo App - Daily Recap'
          : 'Eddo App - Daily Briefing';

      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println(headerText);
      printer.bold(false);
      printer.setTextNormal();

      if (options.timestamp) {
        printer.println(new Date(options.timestamp).toLocaleString());
      }

      printer.drawLine();

      // Content (will be formatted by formatter)
      printer.alignLeft();
      printer.println(options.content);

      printer.drawLine();

      // Footer
      printer.alignCenter();
      printer.println('');
      printer.setTextSize(0, 0);
      printer.println(footerText);
      printer.setTextNormal();

      printer.newLine();
      printer.cut();

      await printer.execute();
      console.log('Briefing printed successfully');
    };

    await Promise.race([printPromise(), timeoutPromise]);
  } catch (error) {
    console.error('Failed to print briefing:', error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    printer.clear();
  }
}
