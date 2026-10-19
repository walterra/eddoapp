import { z } from 'zod';

const databaseInfoSchema = z.object({
  doc_count: z.number(),
  update_seq: z.union([z.string(), z.number()]),
});
const inventorySchema = z.object({
  rows: z.array(z.object({ id: z.string(), value: z.object({ rev: z.string() }) })),
});
export type DatabaseInfo = z.infer<typeof databaseInfoSchema>;
export type DatabaseInventory = z.infer<typeof inventorySchema>;

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
  const databases = z.array(z.string()).parse(await couchRequest(url.toString(), '/_all_dbs'));
  return databases.filter((database) => includeSystem || !database.startsWith('_'));
}

/** Captures the live document revisions and security settings for an archive. */
export async function snapshotDatabase(databaseUrl: string): Promise<DatabaseSnapshot> {
  const info = databaseInfoSchema.parse(await couchRequest(databaseUrl));
  const inventory = inventorySchema.parse(await couchRequest(databaseUrl, '/_all_docs'));
  const security = z
    .record(z.string(), z.unknown())
    .parse(await couchRequest(databaseUrl, '/_security'));
  return { info, inventory, security };
}
