import { z } from 'zod';

/**
 * Environment configuration schema with validation and defaults
 */
export const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // CouchDB Configuration
  COUCHDB_URL: z.string().default('http://admin:password@localhost:5984'),
  COUCHDB_DB_NAME: z.string().default('todos-dev'),

  // MCP Server Configuration
  MCP_SERVER_URL: z.string().default('http://localhost:3001/mcp'),
  MCP_TEST_PORT: z.coerce.number().default(3003),

  // Test-specific CouchDB Configuration
  COUCHDB_TEST_URL: z.string().optional(),
  COUCHDB_TEST_DB_NAME: z.string().default('todos-test'),

  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Anthropic API Configuration
  ANTHROPIC_API_KEY: z.string().optional(),

  // Bot Configuration
  BOT_PERSONA_ID: z
    .enum(['butler', 'gtd_coach', 'zen_master'])
    .default('butler'),
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

/**
 * Get test-specific CouchDB configuration
 */
export function getTestCouchDbConfig(env: Env) {
  const testUrl = env.COUCHDB_TEST_URL || env.COUCHDB_URL;
  return {
    url: testUrl,
    dbName: env.COUCHDB_TEST_DB_NAME,
    fullUrl: `${testUrl}/${env.COUCHDB_TEST_DB_NAME}`,
  };
}

/**
 * Discover available databases on the CouchDB server
 */
export async function getAvailableDatabases(env: Env): Promise<string[]> {
  try {
    // Parse the CouchDB URL to extract credentials and base URL
    const url = new URL(env.COUCHDB_URL);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials =
      url.username && url.password
        ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
        : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${baseUrl}/_all_dbs`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch databases: ${response.statusText}`);
    }

    const databases: string[] = await response.json();

    // Filter out system databases (those starting with _)
    return databases.filter((db) => !db.startsWith('_'));
  } catch (error) {
    console.error('Error fetching available databases:', error);
    return [];
  }
}

// For backward compatibility in client code that expects these exports
// Client will provide its own env via Vite, server/telegram-bot will load via dotenv-mono
export const env =
  typeof process !== 'undefined' && process.env
    ? validateEnv(process.env)
    : ({} as Env);
