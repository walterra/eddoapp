import { createEnv } from '@eddo/core-server';
import { createHash } from 'node:crypto';

export interface CouchEndpoint {
  url: string;
  headers: Record<string, string>;
}

/** Removes URL credentials before handing an endpoint to the storage adapter. */
export function createCouchEndpoint(couchUrl: string, database: string): CouchEndpoint {
  const url = new URL(couchUrl);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (url.username || url.password) {
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    headers.Authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
  }
  url.username = '';
  url.password = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(database)}`;
  return { url: url.toString(), headers };
}

/** Names isolated runtime databases without username sanitization collisions. */
export function getDurableDatabaseName(prefix: string, username: string): string {
  const hash = createHash('sha256').update(username).digest('hex');
  return `${prefix}_pi_durable_${hash}`;
}

/** Sends bounded CouchDB requests without retrying ambiguous writes. */
export async function couchRequest(
  endpoint: CouchEndpoint,
  document: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${endpoint.url.replace(/\/$/, '')}${document}`, {
    ...init,
    headers: { ...endpoint.headers, ...init.headers },
    redirect: 'error',
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  return response;
}

/** Provisions a dedicated private database before opening the journal. */
export async function provisionDurableDatabase(username: string): Promise<CouchEndpoint> {
  const env = createEnv();
  const prefix = env.NODE_ENV === 'test' ? env.DATABASE_TEST_PREFIX : env.DATABASE_PREFIX;
  const endpoint = createCouchEndpoint(env.COUCHDB_URL, getDurableDatabaseName(prefix, username));
  const response = await couchRequest(endpoint, '', { method: 'PUT' });
  if (!response.ok && response.status !== 412) {
    throw new Error(`Durable database provisioning failed: HTTP ${response.status}`);
  }
  // Runtime journals contain private transcript/tool data. Only server admins access them.
  const security = await couchRequest(endpoint, '/_security', {
    method: 'PUT',
    body: JSON.stringify({ admins: { roles: ['_admin'] }, members: { roles: ['_admin'] } }),
  });
  if (!security.ok) throw new Error(`Durable database security failed: HTTP ${security.status}`);
  return endpoint;
}
