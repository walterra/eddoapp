import { getCouchDbConfig, getEffectiveDbName, validateEnv } from '@eddo/core';
import 'dotenv-mono/load';

// Use the core environment validation for all configuration
const env = validateEnv(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  jwtSecret:
    env.JWT_SECRET ||
    'development-secret-key-at-least-32-characters-long-for-dev-only',
  corsOrigin: env.CORS_ORIGIN,

  // Use core CouchDB configuration
  couchdb: getCouchDbConfig(env),

  // Helper to get CouchDB auth header
  getCouchDbAuthHeader(): string | undefined {
    const url = new URL(env.COUCHDB_URL);
    if (url.username && url.password) {
      return `Basic ${Buffer.from(`${url.username}:${url.password}`).toString('base64')}`;
    }
    return undefined;
  },

  // Helper to get full CouchDB URL without credentials (for fetch API)
  getCouchDbUrl(path: string = ''): string {
    const url = new URL(env.COUCHDB_URL);
    // Remove credentials from URL for fetch API compatibility
    url.username = '';
    url.password = '';
    const effectiveDbName = getEffectiveDbName(env);
    return `${url.toString()}${effectiveDbName}${path}`;
  },
};
