import { type Env, validateEnv } from '@eddo/shared';
import { dotenvLoad } from 'dotenv-mono';
import { z } from 'zod';

// Load environment variables
dotenvLoad();

// Extend the shared environment schema with telegram-specific required fields
const TelegramConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  MCP_API_KEY: z
    .string()
    .min(1, 'MCP API key is required for server authentication'),
  TELEGRAM_ALLOWED_USERS: z.string().optional(),
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

// Parse allowed users from comma-separated string
function parseAllowedUsers(allowedUsersString?: string): Set<number> {
  if (!allowedUsersString || allowedUsersString.trim() === '') {
    return new Set();
  }

  return new Set(
    allowedUsersString
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '')
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id)),
  );
}

export const allowedUsers = parseAllowedUsers(appConfig.TELEGRAM_ALLOWED_USERS);

export { appConfig };
export type { Config };
