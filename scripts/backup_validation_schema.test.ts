import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  backupHeaderSchema,
  inspectBackup,
  visitBackup,
  type BackupDocument,
} from './backup_inspection.js';

const directories: string[] = [];
const header = { name: '@cloudant/couchbackup', version: '2', mode: 'full' };
function archive(documents: readonly BackupDocument[], attachments = false): string {
  const directory = mkdtempSync(join(tmpdir(), 'eddo-schema-backup-'));
  directories.push(directory);
  const path = join(directory, 'archive.json');
  writeFileSync(
    path,
    JSON.stringify({ ...header, attachments }) + '\n' + JSON.stringify(documents) + '\n',
  );
  return path;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('backup validation compatibility', () => {
  it('preserves header defaults and projects unrelated fields', () => {
    expect(backupHeaderSchema.parse({ ...header, unrelated: true })).toEqual({
      ...header,
      attachments: false,
    });
    expect(backupHeaderSchema.safeParse({ ...header, attachments: null }).success).toBe(false);
  });

  it('preserves arbitrary document properties for visitors', async () => {
    const document = { _id: 'doc', _rev: '1-rev', custom: { nested: ['retained'] } };
    const visited: BackupDocument[] = [];
    await visitBackup(archive([document]), (value) => {
      visited.push(value);
    });
    expect(visited).toEqual([document]);
  });

  it('preserves inline attachment metadata and validates its bytes', async () => {
    const document = {
      _id: 'doc',
      _attachments: { file: { data: 'dGVzdA==', content_type: 'text/plain' } },
    };
    const path = archive([document], true);
    const result = await inspectBackup(path);
    expect(result.errors).toEqual([]);
    expect(result.attachments).toBe(1);
    const visited: BackupDocument[] = [];
    await visitBackup(path, (value) => {
      visited.push(value);
    });
    expect(visited[0]._attachments).toEqual(document._attachments);
  });
});
