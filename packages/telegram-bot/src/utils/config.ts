import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

const ConfigSchema = z.object({
  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),

  // Anthropic API Configuration
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),

  // MCP Server Configuration
  MCP_SERVER_URL: z.string().url().default('http://localhost:3001/mcp'),

  // Application Configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Claude Code SDK Configuration
  CLAUDE_CODE_WORKING_DIR: z.string().default('./bot_workspace'),
  CLAUDE_CODE_SESSION_TIMEOUT: z.coerce.number().default(3600),
});

type Config = z.infer<typeof ConfigSchema>;

let appConfig: Config;

try {
  appConfig = ConfigSchema.parse(process.env);
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export { appConfig };
export type { Config };
