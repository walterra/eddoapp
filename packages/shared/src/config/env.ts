import { z } from 'zod';

/**
 * Environment configuration schema with validation and defaults
 */
export const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // CouchDB Configuration
  COUCHDB_URL: z.string().default('http://admin:password@localhost:5984'),
  COUCHDB_DB_NAME: z.string().default('todos-dev'),
  
  // MCP Server Configuration
  MCP_SERVER_URL: z.string().default('http://localhost:3001/mcp'),
  
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  
  // Anthropic API Configuration
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Bot Configuration
  BOT_PERSONA_ID: z.enum(['butler', 'gtd_coach', 'zen_master']).default('butler'),
  LLM_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  
  // Claude Code SDK Configuration
  CLAUDE_CODE_WORKING_DIR: z.string().default('./bot_workspace'),
  CLAUDE_CODE_SESSION_TIMEOUT: z.coerce.number().default(3600),
});

/**
 * Type definition for the environment configuration
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse environment configuration
 */
export function validateEnv(env: unknown): Env {
  return envSchema.parse(env);
}

/**
 * Get the full CouchDB database URL
 */
export function getCouchDbUrl(env: Env): string {
  return `${env.COUCHDB_URL}/${env.COUCHDB_DB_NAME}`;
}

/**
 * Get CouchDB connection configuration
 */
export function getCouchDbConfig(env: Env) {
  return {
    url: env.COUCHDB_URL,
    dbName: env.COUCHDB_DB_NAME,
    fullUrl: getCouchDbUrl(env),
  };
}

// For backward compatibility in client code that expects these exports
// Client will provide its own env via Vite, server/telegram-bot will load via dotenv-mono
export const env = typeof process !== 'undefined' && process.env 
  ? validateEnv(process.env) 
  : {} as Env;