// @vitest-environment node
import couchbackup from '@cloudant/couchbackup';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteBackupFile, type BackupFileWithDate } from './backup-retention-utils.js';
import { getAllBackupFiles } from './backup-utils.js';
import { createBackupArchive } from './backup_archive.js';
import { metadataPath, readBackupMetadata, validateBackupArchive } from './backup_metadata.js';
import { snapshotDatabase } from './backup_transport.js';

vi.mock('@cloudant/couchbackup', () => ({ default: { backup: vi.fn() } }));
vi.mock('./backup_transport.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./backup_transport.js')>()),
  snapshotDatabase: vi.fn(),
}));
let directory: string;
const header = {
  name: '@cloudant/couchbackup',
  version: '2.11.12',
  mode: 'full',
  attachments: true,
};
const snapshot = {
  info: { doc_count: 1, update_seq: '1-a' },
  inventory: { rows: [{ id: 'a', value: { rev: '1-a' } }] },
  security: { members: { names: ['walterra'], roles: [] } },
};
const options = (): Parameters<typeof createBackupArchive>[0] => ({
  databaseUrl: 'http://admin:secret@localhost:5984/eddo_test',
  directory,
});
function mockBackup(documents: unknown[]): void {
  vi.mocked(couchbackup.backup).mockImplementation((_url, output, _options, callback) => {
    (output as Writable).write(JSON.stringify(header) + '\n' + JSON.stringify(documents) + '\n');
    callback?.(null, {});
    return new EventEmitter();
  });
}
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eddo-backup-workflow-'));
  vi.mocked(snapshotDatabase).mockReset().mockResolvedValue(snapshot);
  mockBackup([{ _id: 'a', _rev: '1-a', title: 'Unicode 🐘' }]);
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('archive publication', () => {
  it('publishes flushed archives with private metadata and source inventory', async () => {
    const file = await createBackupArchive(options());
    expect(readBackupMetadata(file)).toMatchObject({
      database: 'eddo_test',
      revisions: ['a@1-a'],
      security: snapshot.security,
    });
    await expect(validateBackupArchive(file)).resolves.toMatchObject({ documents: 1 });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.statSync(metadataPath(file)).mode & 0o777).toBe(0o600);
    expect(getAllBackupFiles(directory)).toHaveLength(1);
  });
  it('does not publish missing source documents', async () => {
    mockBackup([]);
    await expect(createBackupArchive(options())).rejects.toThrow('missing');
    expect(getAllBackupFiles(directory)).toEqual([]);
  });
  it('does not publish archives from a changing database', async () => {
    vi.mocked(snapshotDatabase)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ...snapshot, info: { doc_count: 1, update_seq: '2-b' } });
    await expect(createBackupArchive(options())).rejects.toThrow('changed');
    expect(getAllBackupFiles(directory)).toEqual([]);
  });
  it('does not publish failed library backups', async () => {
    vi.mocked(couchbackup.backup).mockImplementation((_url, _output, _options, callback) => {
      callback?.(new Error('credentials must not escape'));
      return new EventEmitter();
    });
    await expect(createBackupArchive(options())).rejects.toThrow('backup failed');
    expect(getAllBackupFiles(directory)).toEqual([]);
  });
  it('rejects checksummed archives after truncation or corruption', async () => {
    const file = await createBackupArchive(options());
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Unicode', 'Changed'));
    await expect(validateBackupArchive(file)).rejects.toThrow('checksum');
  });
  it('rejects metadata with missing revision inventory', async () => {
    const file = await createBackupArchive(options());
    const metadata = readBackupMetadata(file)!;
    fs.writeFileSync(
      metadataPath(file),
      JSON.stringify({ ...metadata, revisions: ['missing@1-b'] }),
    );
    await expect(validateBackupArchive(file)).rejects.toThrow('missing');
  });
});

describe('paired retention', () => {
  it('keeps sidecars during dry run and deletes them with the archive', async () => {
    const file = await createBackupArchive(options());
    const backup: BackupFileWithDate = {
      path: file,
      database: 'eddo_test',
      timestamp: '',
      size: 1,
      date: new Date(),
      weekKey: '',
      monthKey: '',
    };
    deleteBackupFile(backup, true);
    expect(fs.existsSync(metadataPath(file))).toBe(true);
    expect(deleteBackupFile(backup, false).success).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(metadataPath(file))).toBe(false);
  });
});
