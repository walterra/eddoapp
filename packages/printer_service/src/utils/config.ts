import { dotenvLoad } from 'dotenv-mono';
import { z } from 'zod';

// Load environment variables
dotenvLoad();

/**
 * Printer-specific configuration schema
 */
const printerConfigSchema = z.object({
  PRINTER_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  PRINTER_IP_ADDRESS: z.string().ip().optional(),
  PRINTER_PORT: z.coerce.number().default(9100),
  PRINTER_SCHEDULE_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Schedule time must be in HH:MM format')
    .default('07:00'),
});

/**
 * Printer service configuration type
 */
export type PrinterConfig = z.infer<typeof printerConfigSchema>;

/**
 * Create and validate printer service configuration
 */
export function createPrinterConfig(): PrinterConfig {
  const printerConfig = printerConfigSchema.parse(process.env);
  return printerConfig;
}

/**
 * Global configuration instance
 */
export const appConfig = createPrinterConfig();
