import {
  coerceNumber,
  createFieldNormalizer,
} from '@eddo/core-shared/validation/field_normalization';
import {
  createSchemaParser,
  num,
  obj,
  oneOf,
  opt,
  str,
} from '@eddo/core-shared/validation/schema_parser';

/**
 * Environment configuration schema with validation and defaults
 */
const envFields = {
  // Node environment
  NODE_ENV: oneOf(['development', 'production', 'test']),

  // Logging
  LOG_LEVEL: oneOf(['error', 'warn', 'info', 'debug']),

  // CouchDB Configuration
  COUCHDB_URL: str(),
  COUCHDB_DB_NAME: str(),
  COUCHDB_API_KEY: opt(str()),

  // Database Naming Configuration
  DATABASE_PREFIX: str(),
  DATABASE_TEST_PREFIX: str(),

  // MCP Server Configuration
  MCP_SERVER_URL: str(),
  MCP_SERVER_PORT: num(),

  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: opt(str()),

  // Anthropic API Configuration
  ANTHROPIC_API_KEY: opt(str()),

  // Bot Configuration
  BOT_PERSONA_ID: oneOf(['butler', 'gtd_coach', 'zen_master']),
  LLM_MODEL: str(),

  // Claude Code SDK Configuration
  CLAUDE_CODE_WORKING_DIR: str(),
  CLAUDE_CODE_SESSION_TIMEOUT: num(),

  // Web Client Configuration (Vite environment variables)

  // Web API Configuration
  PORT: num(),
  JWT_SECRET: opt(str()),
  CORS_ORIGIN: str(),

  // Google OAuth Configuration (for email sync)
  GOOGLE_CLIENT_ID: opt(str()),
  GOOGLE_CLIENT_SECRET: opt(str()),
  GOOGLE_REDIRECT_URI: str(),

  // OpenTelemetry Configuration (for RUM proxy)
  OTEL_EXPORTER_OTLP_ENDPOINT: str(),
  OTEL_API_KEY: opt(str()),
  OTEL_EXPORTER_OTLP_HEADERS: opt(str()),
};
const envDefinition = obj(envFields);
const normalizeEnvironment = createFieldNormalizer({
  fields: Object.keys(envFields),
  defaults: {
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    COUCHDB_DB_NAME: 'todos-dev',
    DATABASE_PREFIX: 'eddo',
    DATABASE_TEST_PREFIX: 'eddo_test',
    MCP_SERVER_URL: 'http://localhost:3001/mcp',
    MCP_SERVER_PORT: 3001,
    BOT_PERSONA_ID: 'butler',
    LLM_MODEL: 'claude-sonnet-4-5-20250929',
    CLAUDE_CODE_WORKING_DIR: './bot_workspace',
    CLAUDE_CODE_SESSION_TIMEOUT: 3600,
    PORT: 3000,
    CORS_ORIGIN: 'http://localhost:5173',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/email/oauth/callback',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  },
  conversions: {
    MCP_SERVER_PORT: coerceNumber,
    CLAUDE_CODE_SESSION_TIMEOUT: coerceNumber,
    PORT: coerceNumber,
  },
});

export const envSchema = createSchemaParser(envDefinition, {
  normalize: normalizeEnvironment,
  validate: (value) =>
    value.JWT_SECRET !== undefined && value.JWT_SECRET.length < 32
      ? [
          {
            path: '/JWT_SECRET',
            code: 'minLength',
            message: 'JWT secret must be at least 32 characters',
          },
        ]
      : [],
});

/**
 * Type definition for the environment configuration
 */
export type Env = ReturnType<typeof envSchema.parse>;

/**
 * Validate and parse environment configuration
 */
export function validateEnv(env: unknown): Env {
  return envSchema.parse(env);
}

/**
 * Get the effective database name (with API key suffix if provided)
 */
export function getEffectiveDbName(env: Env): string {
  const baseName = env.COUCHDB_DB_NAME;
  // Legacy API key support - no longer needed with JWT authentication
  const apiKey = env.COUCHDB_API_KEY;
  return apiKey ? `${baseName}_api_${apiKey}` : baseName;
}

/**
 * Get the full CouchDB database URL
 */
export function getCouchDbUrl(env: Env): string {
  return `${env.COUCHDB_URL}/${getEffectiveDbName(env)}`;
}

/**
 * Get CouchDB connection configuration
 */
export function getCouchDbConfig(env: Env) {
  return {
    url: env.COUCHDB_URL,
    dbName: getEffectiveDbName(env),
    fullUrl: getCouchDbUrl(env),
  };
}

/**
 * Get test-specific User Registry configuration
 * With testcontainers, tests use isolated containers so same database name is fine
 */
export function getTestUserRegistryConfig(env: Env) {
  const dbName = getEffectiveDbName(env);
  return {
    url: env.COUCHDB_URL,
    dbName: `${dbName}_user_registry`,
    fullUrl: `${env.COUCHDB_URL}/${dbName}_user_registry`,
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
// Note: Environment validation is now explicit - call validateEnv() or createEnv() where needed
export const env = {} as Env;

/**
 * Create and validate environment configuration
 * Call this explicitly where environment validation is needed
 */
export function createEnv(): Env {
  if (typeof process === 'undefined' || !process.env) {
    throw new Error('Environment variables not available');
  }
  return validateEnv(process.env);
}
