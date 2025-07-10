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

// Telegram user ID validation schema
const TelegramUserIdSchema = z
  .number()
  .min(1, 'User ID must be positive')
  .max(999999999999, 'User ID too large for Telegram platform');

// Parse allowed users from comma-separated string
export function parseAllowedUsers(allowedUsersString?: string): Set<number> {
  if (!allowedUsersString || allowedUsersString.trim() === '') {
    return new Set();
  }

  const validUserIds = allowedUsersString
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
    .map((id) => {
      const parsed = parseInt(id, 10);
      if (isNaN(parsed)) {
        console.warn(`Invalid user ID format: "${id}" - skipping`);
        return null;
      }

      const validation = TelegramUserIdSchema.safeParse(parsed);
      if (!validation.success) {
        console.warn(
          `Invalid user ID: ${parsed} - ${validation.error.issues[0]?.message} - skipping`,
        );
        return null;
      }

      return parsed;
    })
    .filter((id): id is number => id !== null);

  return new Set(validUserIds);
}

export const allowedUsers = parseAllowedUsers(appConfig.TELEGRAM_ALLOWED_USERS);

export { appConfig };
export type { Config };
