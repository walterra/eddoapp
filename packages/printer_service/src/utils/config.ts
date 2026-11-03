import { dotenvLoad } from 'dotenv-mono';
import { parsePrinterConfig } from './config_schema.js';

export type { PrinterConfig } from './config_schema.js';

dotenvLoad();

/** Validates the printer environment once during service startup. */
export const appConfig = parsePrinterConfig(process.env);
