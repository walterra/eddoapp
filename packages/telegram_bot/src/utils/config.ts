import { type Env, validateEnv } from '@eddo/core-server';
import { dotenvLoad } from 'dotenv-mono';
import { parseTelegramConfig, type TelegramConfig } from './config_schema.js';

// Load environment variables
dotenvLoad();

// Combined configuration type
type Config = Env & TelegramConfig;

let appConfig: Config;

try {
  // Validate shared environment
  const sharedEnv = validateEnv(process.env);

  // Validate telegram-specific required fields
  const telegramFields = parseTelegramConfig(process.env);

  // Combine configurations
  appConfig = { ...sharedEnv, ...telegramFields };
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export { appConfig };
export type { Config };
