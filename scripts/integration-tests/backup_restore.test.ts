import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackupArchive } from '../backup_archive.js';
import { readBackupMetadata, validateBackupArchive } from '../backup_metadata.js';
import { restoreBackupArchive } from '../backup_restore.js';
import { discoverBackupDatabases } from '../backup_transport.js';

let container: StartedCouchDBContainer;
let origin: string;
let credentials: string;
let directory: string;
const password = randomBytes(24).toString('hex');

async function request(route: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await fetch(`${origin}/${route}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Test CouchDB request failed: ${response.status}`);
  return response.json();
}
function databaseUrl(name: string): string {
  return origin.replace('http://', `http://admin:${password}@`) + `/${name}`;
}

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eddo-backup-integration-'));
  container = await new CouchDBContainer('couchdb:3')
    .withUsername('admin')
    .withPassword(password)
    .start();
  origin = `http://${container.getHost()}:${container.getMappedPort(5984)}`;
  credentials = Buffer.from(`admin:${password}`).toString('base64');
});
afterAll(async () => {
  await container?.stop();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

describe('CouchDB backup round trip', () => {
  it('restores Unicode, attachments, revisions, conflicts, tombstones, and security', async () => {
    await request('source', 'PUT');
    await request('target', 'PUT');
    const description = 'a'.repeat(65500) + '💥⚠️│→'.repeat(20000);
    const attachment = Buffer.from('Binary attachment 🐘\u0000\ufffd');
    await request('source/_bulk_docs', 'POST', {
      new_edits: false,
      docs: [
        { _id: 'unicode', _rev: '1-a', description },
        {
          _id: 'attachment',
          _rev: '1-a',
          _attachments: {
            'image.txt': { content_type: 'text/plain', data: attachment.toString('base64') },
          },
        },
        { _id: 'conflict', _rev: '1-a', value: 1 },
        { _id: 'conflict', _rev: '1-b', value: 2 },
        { _id: 'deleted', _rev: '1-a', _deleted: true },
        {
          _id: '_design/example',
          _rev: '1-a',
          views: { all: { map: 'function(doc) { emit(doc._id, null); }' } },
        },
      ],
    });
    const security = {
      admins: { names: ['admin'], roles: [] },
      members: { names: ['walterra'], roles: [] },
    };
    await request('source/_security', 'PUT', security);
    const file = await createBackupArchive({ databaseUrl: databaseUrl('source'), directory });
    await restoreBackupArchive(file, databaseUrl('target'));
    expect(await request('target/unicode')).toEqual(await request('source/unicode'));
    expect(await request('target/attachment?attachments=true')).toEqual(
      await request('source/attachment?attachments=true'),
    );
    expect(await request('target/conflict?open_revs=all')).toEqual(
      await request('source/conflict?open_revs=all'),
    );
    expect(await request('target/_changes')).toMatchObject({
      results: expect.arrayContaining([expect.objectContaining({ id: 'deleted', deleted: true })]),
    });
    expect(await request('target/_security')).toEqual(security);
    expect(readBackupMetadata(file)?.documentCount).toBe(4);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
  it('backs up and restores empty databases', async () => {
    await request('empty_source', 'PUT');
    await request('empty_target', 'PUT');
    const file = await createBackupArchive({ databaseUrl: databaseUrl('empty_source'), directory });
    await expect(validateBackupArchive(file)).resolves.toMatchObject({ documents: 0 });
    await restoreBackupArchive(file, databaseUrl('empty_target'));
    expect(await request('empty_target')).toMatchObject({ doc_count: 0 });
  });
  it('restores legacy non-attachment archives and rejects tampering before writing', async () => {
    await request('legacy', 'PUT');
    const file = path.join(directory, 'legacy.json');
    fs.writeFileSync(
      file,
      JSON.stringify([{ _id: 'legacy', _rev: '1-a', description: '🐘' }]) + '\n',
    );
    await restoreBackupArchive(file, databaseUrl('legacy'));
    expect(await request('legacy/legacy')).toMatchObject({ description: '🐘' });
    const archive = await createBackupArchive({ databaseUrl: databaseUrl('legacy'), directory });
    fs.appendFileSync(archive, '\n');
    await expect(restoreBackupArchive(archive, databaseUrl('legacy'))).rejects.toThrow('checksum');
    expect(await request('legacy/legacy')).toMatchObject({ description: '🐘' });
  });
  it('discovers system databases through explicit full-server scope', async () => {
    await request('_users', 'PUT');
    expect(await discoverBackupDatabases(databaseUrl(''), true)).toContain('_users');
    expect(await discoverBackupDatabases(databaseUrl(''))).not.toContain('_users');
  });
});
