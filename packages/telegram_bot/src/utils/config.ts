import { type Env, validateEnv } from '@eddo/core-server';
import { dotenvLoad } from 'dotenv-mono';
import { z } from 'zod';

// Load environment variables
dotenvLoad();

// Extend the shared environment schema with telegram-specific required fields
const TelegramConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  WEB_API_BASE_URL: z
    .string()
    .url('Web API base URL must be a valid URL')
    .default('http://localhost:3000'),
  TELEGRAM_LOG_USER_DETAILS: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
});

// Type for telegram-specific config
type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

// Combined configuration type
type Config = Env & TelegramConfig;

let appConfig: Config;

try {
  // Validate shared environment
  const sharedEnv = validateEnv(process.env);

  // Validate telegram-specific required fields
  const telegramFields = TelegramConfigSchema.parse(process.env);

  // Combine configurations
  appConfig = { ...sharedEnv, ...telegramFields };
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export { appConfig };
export type { Config };
