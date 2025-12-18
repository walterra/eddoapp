/**
 * Printer service exports for integration with other packages
 */

// Export printer client functions
export { printBriefing, printTestPage, testConnection } from './printer/client.js';

// Export formatter functions
export { formatBriefingForPrint } from './printer/formatter.js';

// Export config
export { appConfig } from './utils/config.js';

// Export types
export type { PrintOptions, PrinterConnectionResult } from './printer/client.js';
export type { PrinterConfig } from './utils/config.js';
