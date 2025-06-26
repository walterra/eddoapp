import { env, type Env } from '@eddo/shared';
import { z } from 'zod';

// Extend the shared environment schema with telegram-specific required fields
const TelegramConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
});

// Type for telegram-specific config
type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

// Combined configuration type
type Config = Env & TelegramConfig;

let appConfig: Config;

try {
  // Validate telegram-specific required fields
  const telegramFields = TelegramConfigSchema.parse(process.env);
  
  // Combine with shared env config
  appConfig = { ...env, ...telegramFields };
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export { appConfig };
export type { Config };
