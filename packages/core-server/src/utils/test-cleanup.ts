/**
 * Database cleanup utilities for test environments
 */
import nano from 'nano';

import type { Env } from '../config/env';
import { createEnv, getCouchDbConfig } from '../config/env';
import {
  extractUsernameFromDatabaseName,
  getDatabasePrefix,
  isUserDatabase,
  isUserRegistryDatabase,
} from './database-names';
import type {
  CleanupResult,
  DatabaseInfo,
  RequiredCleanupOptions,
  TestCleanupOptions,
} from './test-cleanup-types';
import { createEmptyCleanupResult } from './test-cleanup-types';

export type { CleanupResult, DatabaseInfo, TestCleanupOptions } from './test-cleanup-types';

type CouchClient = ReturnType<typeof nano>;

const DEFAULT_OPTIONS: Omit<RequiredCleanupOptions, 'env'> = {
  dryRun: false,
  verbose: false,
  maxAge: 24,
  force: false,
};

const createLogger =
  (verbose: boolean) =>
  (msg: string, ...args: unknown[]) => {
    if (verbose) console.log(msg, ...args);
  };

/** Classify a database by type and extract metadata */
function classifyDatabase(databaseName: string, env: Env): DatabaseInfo {
  const info: DatabaseInfo = { name: databaseName, type: 'unknown', isTestDatabase: false };
  const isTest = env.NODE_ENV === 'test' || databaseName.includes('test');

  if (isUserDatabase(databaseName, env)) {
    return {
      ...info,
      type: 'user',
      username: extractUsernameFromDatabaseName(databaseName, env) || undefined,
      prefix: getDatabasePrefix(env),
      isTestDatabase: isTest,
    };
  }
  if (isUserRegistryDatabase(databaseName, env)) {
    return {
      ...info,
      type: 'user_registry',
      prefix: getDatabasePrefix(env),
      isTestDatabase: isTest,
    };
  }
  if (databaseName.startsWith('test-')) return { ...info, type: 'test', isTestDatabase: true };
  if (databaseName.includes('_api_')) {
    const parts = databaseName.split('_api_');
    return {
      ...info,
      type: 'api_keyed',
      apiKey: parts.length === 2 ? parts[1] : undefined,
      isTestDatabase: databaseName.includes('test'),
    };
  }
  if (databaseName.startsWith(env.DATABASE_TEST_PREFIX))
    return { ...info, isTestDatabase: true, prefix: env.DATABASE_TEST_PREFIX };
  return info;
}

interface CleanupContext {
  couch: CouchClient;
  env: Env;
  opts: RequiredCleanupOptions;
  log: ReturnType<typeof createLogger>;
}

/** Check if a database is safe to delete */
async function isSafeToDelete(ctx: CleanupContext, info: DatabaseInfo): Promise<boolean> {
  if (!info.isTestDatabase && ctx.env.NODE_ENV === 'production') return false;
  if (!info.isTestDatabase && !ctx.opts.force) return false;
  if (!ctx.opts.force) {
    try {
      const dbInfo = await ctx.couch.db.get(info.name);
      if (dbInfo.doc_count > 0) {
        ctx.log(`Database ${info.name} has ${dbInfo.doc_count} documents, skipping unless forced`);
        return false;
      }
    } catch {
      return true;
    }
  }
  return true;
}

/** Delete a single database */
async function deleteDatabase(
  couch: CouchClient,
  name: string,
  dryRun: boolean,
  log: ReturnType<typeof createLogger>,
): Promise<boolean> {
  try {
    if (dryRun) {
      log(`[DRY RUN] Would delete database: ${name}`);
      return true;
    }
    await couch.db.destroy(name);
    log(`🗑️  Deleted database: ${name}`);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      log(`ℹ️  Database ${name} doesn't exist`);
      return true;
    }
    log(`❌ Failed to delete database ${name}:`, error);
    return false;
  }
}

/** Process databases for cleanup */
async function processDatabasesForCleanup(
  databases: string[],
  ctx: CleanupContext,
): Promise<CleanupResult> {
  const result = createEmptyCleanupResult();
  result.summary.total = databases.length;

  for (const dbName of databases) {
    const info = classifyDatabase(dbName, ctx.env);
    ctx.log(`Analyzing database: ${dbName} (type: ${info.type}, isTest: ${info.isTestDatabase})`);
    if (!(await isSafeToDelete(ctx, info))) {
      result.skipped.push(dbName);
      result.summary.skipped++;
      continue;
    }
    if (await deleteDatabase(ctx.couch, dbName, ctx.opts.dryRun, ctx.log)) {
      result.cleaned.push(dbName);
      result.summary.cleaned++;
    } else {
      result.errors.push({ database: dbName, error: 'Failed to delete database' });
      result.summary.errors++;
    }
  }
  return result;
}

/** Log cleanup summary */
function logSummary(result: CleanupResult, log: ReturnType<typeof createLogger>) {
  log(`\n📊 Cleanup Summary:`);
  log(`  Total databases analyzed: ${result.summary.total}`);
  log(`  Cleaned up: ${result.summary.cleaned}`);
  log(`  Skipped: ${result.summary.skipped}`);
  log(`  Errors: ${result.summary.errors}`);
}

/** Get all non-system databases */
async function getAllDatabases(
  couch: CouchClient,
  log: ReturnType<typeof createLogger>,
): Promise<string[]> {
  try {
    const databases = await couch.db.list();
    return databases.filter((db) => !db.startsWith('_'));
  } catch (error) {
    log('Error fetching databases:', error);
    return [];
  }
}

/** Factory to create test cleanup instance */
export function createTestCleanup(options: TestCleanupOptions = {}) {
  const env = options.env || createEnv();
  const opts: RequiredCleanupOptions = { ...DEFAULT_OPTIONS, env, ...options };
  const log = createLogger(opts.verbose);
  const couch = nano(getCouchDbConfig(env).url);
  const ctx: CleanupContext = { couch, env, opts, log };

  return {
    getAllDatabases: () => getAllDatabases(couch, log),
    classifyDatabase: (name: string) => classifyDatabase(name, env),
    async cleanupTestDatabases(): Promise<CleanupResult> {
      const dbs = await getAllDatabases(couch, log);
      log(`Found ${dbs.length} databases to analyze`);
      const result = await processDatabasesForCleanup(dbs, ctx);
      logSummary(result, log);
      return result;
    },
    async cleanupUserDatabases(username: string): Promise<CleanupResult> {
      const all = await getAllDatabases(couch, log);
      const userDbs = all.filter((name) => classifyDatabase(name, env).username === username);
      log(`Found ${userDbs.length} databases for user: ${username}`);
      return processDatabasesForCleanup(userDbs, ctx);
    },
    async cleanupDatabasesByPattern(pattern: RegExp): Promise<CleanupResult> {
      const all = await getAllDatabases(couch, log);
      const matching = all.filter((name) => pattern.test(name));
      log(`Found ${matching.length} databases matching pattern: ${pattern}`);
      return processDatabasesForCleanup(matching, ctx);
    },
    async getDatabaseReport(): Promise<DatabaseInfo[]> {
      const dbs = await getAllDatabases(couch, log);
      return dbs.map((name) => classifyDatabase(name, env));
    },
  };
}

export type TestDatabaseCleanup = ReturnType<typeof createTestCleanup>;

/** Quick cleanup function for common test scenarios */
export const quickCleanup = (options: TestCleanupOptions = {}): Promise<CleanupResult> =>
  createTestCleanup(options).cleanupTestDatabases();

/** Cleanup databases for a specific user */
export const cleanupUserDatabases = (
  username: string,
  options: TestCleanupOptions = {},
): Promise<CleanupResult> => createTestCleanup(options).cleanupUserDatabases(username);

/** Cleanup databases matching a pattern */
export const cleanupDatabasesByPattern = (
  pattern: RegExp,
  options: TestCleanupOptions = {},
): Promise<CleanupResult> => createTestCleanup(options).cleanupDatabasesByPattern(pattern);

/** Get a report of all databases */
export const getDatabaseReport = (options: TestCleanupOptions = {}): Promise<DatabaseInfo[]> =>
  createTestCleanup(options).getDatabaseReport();

/** Cleanup function specifically for CI/CD environments */
export const cleanupCIEnvironment = (options: TestCleanupOptions = {}): Promise<CleanupResult> =>
  createTestCleanup({ ...options, force: true, verbose: true }).cleanupTestDatabases();
