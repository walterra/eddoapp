import { createProjectedParser } from '../packages/core-shared/src/validation/projected_parser.js';
import {
  arr,
  createSchemaParser,
  map,
  num,
  obj,
  str,
  union,
  unknown as unknownSchema,
} from '../packages/core-shared/src/validation/schema_parser.js';

const databaseInfoSchema = createProjectedParser(
  obj({ doc_count: num(), update_seq: union([str(), num()]) }),
);
export const inventorySchema = createProjectedParser(
  obj({ rows: arr(obj({ id: str(), value: obj({ rev: str() }) })) }),
);
const databaseListSchema = createSchemaParser(arr(str()));
const securitySchema = createSchemaParser(map(unknownSchema()));
export type DatabaseInfo = ReturnType<typeof databaseInfoSchema.parse>;
export type DatabaseInventory = ReturnType<typeof inventorySchema.parse>;

export interface DatabaseSnapshot {
  info: DatabaseInfo;
  inventory: DatabaseInventory;
  security: Record<string, unknown>;
}

/** Returns a URL without credentials for diagnostic output. */
export function redactDatabaseUrl(value: string): string {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  return url.toString();
}

/** Reads or writes CouchDB metadata without exposing credentials. */
export async function couchRequest(
  databaseUrl: string,
  suffix = '',
  body?: unknown,
): Promise<unknown> {
  const url = new URL(databaseUrl);
  const authorization = Buffer.from(
    `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`,
  ).toString('base64');
  const response = await fetch(`${redactDatabaseUrl(databaseUrl).replace(/\/$/, '')}${suffix}`, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`CouchDB metadata request failed: HTTP ${response.status}`);
  return response.json();
}

/** Discovers databases; includes system databases only when explicitly requested. */
export async function discoverBackupDatabases(
  serverUrl: string,
  includeSystem = false,
): Promise<string[]> {
  const url = new URL(serverUrl);
  url.pathname = '/';
  const databases = databaseListSchema.parse(await couchRequest(url.toString(), '/_all_dbs'));
  return databases.filter((database) => includeSystem || !database.startsWith('_'));
}

/** Captures the live document revisions and security settings for an archive. */
export async function snapshotDatabase(databaseUrl: string): Promise<DatabaseSnapshot> {
  const info = databaseInfoSchema.parse(await couchRequest(databaseUrl));
  const inventory = inventorySchema.parse(await couchRequest(databaseUrl, '/_all_docs'));
  const security = securitySchema.parse(await couchRequest(databaseUrl, '/_security'));
  return { info, inventory, security };
}
