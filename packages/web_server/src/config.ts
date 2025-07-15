import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // CouchDB configuration
  COUCHDB_URL: z.string().url(),
  COUCHDB_USERNAME: z.string().optional(),
  COUCHDB_PASSWORD: z.string().optional(),
  COUCHDB_ADMIN_USERNAME: z.string().optional(),
  COUCHDB_ADMIN_PASSWORD: z.string().optional(),
  COUCHDB_DB_NAME: z.string().default('todos-prod'),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  corsOrigin: env.CORS_ORIGIN,

  couchdb: {
    url: env.COUCHDB_URL,
    username: env.COUCHDB_USERNAME || env.COUCHDB_ADMIN_USERNAME,
    password: env.COUCHDB_PASSWORD || env.COUCHDB_ADMIN_PASSWORD,
    dbName: env.COUCHDB_DB_NAME,
  },

  // Helper to get CouchDB auth header
  getCouchDbAuthHeader(): string | undefined {
    if (this.couchdb.username && this.couchdb.password) {
      return `Basic ${Buffer.from(`${this.couchdb.username}:${this.couchdb.password}`).toString('base64')}`;
    }
    return undefined;
  },

  // Helper to get full CouchDB URL with auth
  getCouchDbUrl(path: string = ''): string {
    const url = new URL(this.couchdb.url);
    if (this.couchdb.username && this.couchdb.password) {
      url.username = this.couchdb.username;
      url.password = this.couchdb.password;
    }
    return `${url.toString().replace(/\/$/, '')}/${this.couchdb.dbName}${path}`;
  },
};
