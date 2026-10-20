// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackupOptions } from './backup-utils.js';
import { inspectBackup, readBackupHeader } from './backup_inspection.js';
import { discoverBackupDatabases } from './backup_transport.js';

const header = {
  name: '@cloudant/couchbackup',
  version: '2.11.12',
  mode: 'full',
  attachments: true,
};
let directory: string;
function fixture(documents: unknown[], withHeader = true): string {
  const file = path.join(directory, 'backup.json');
  fs.writeFileSync(
    file,
    [withHeader ? JSON.stringify(header) : '', JSON.stringify(documents)]
      .filter(Boolean)
      .join('\n'),
  );
  return file;
}
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eddo-backup-'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('backup integrity', () => {
  it('includes attachment bodies by default', () => {
    expect(createBackupOptions()).toMatchObject({ attachments: true, mode: 'full' });
  });
  it('accepts a header-only empty database archive', async () => {
    const file = fixture([]);
    fs.writeFileSync(file, JSON.stringify(header) + '\n');
    expect((await inspectBackup(file)).errors).toEqual([]);
  });
  it('rejects empty and malformed files', async () => {
    const file = fixture([]);
    fs.writeFileSync(file, '');
    expect((await inspectBackup(file)).errors.length).toBeGreaterThan(0);
    fs.writeFileSync(file, '[broken');
    expect((await inspectBackup(file)).errors.length).toBeGreaterThan(0);
  });
  it('rejects attachment stubs instead of reporting a complete backup', async () => {
    const file = fixture([
      { _id: 'file', _rev: '1-a', _attachments: { image: { stub: true, length: 3 } } },
    ]);
    expect((await inspectBackup(file)).errors.join(' ')).toContain('attachment');
  });
  it('validates attachment bodies and digests', async () => {
    const file = fixture([
      {
        _id: 'file',
        _rev: '1-a',
        _attachments: {
          image: { data: 'YWJj', digest: 'md5-kAFQmDzST7DWlj99KOF/cg==', length: 3 },
        },
      },
    ]);
    expect((await inspectBackup(file)).errors).toEqual([]);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('YWJj', 'eHl6'));
    expect((await inspectBackup(file)).errors.join(' ')).toContain('digest');
  });
  it('accepts distinct leaf revisions and rejects duplicate revisions', async () => {
    expect(
      (
        await inspectBackup(
          fixture([
            { _id: 'a', _rev: '1-a' },
            { _id: 'a', _rev: '1-b' },
          ]),
        )
      ).errors,
    ).toEqual([]);
    expect(
      (
        await inspectBackup(
          fixture([
            { _id: 'a', _rev: '1-a' },
            { _id: 'a', _rev: '1-a' },
          ]),
        )
      ).errors.join(' '),
    ).toContain('Duplicate');
  });
  it('reads legacy headers without enabling attachments', async () => {
    const file = fixture([]);
    fs.writeFileSync(file, JSON.stringify({ ...header, attachments: false }) + '\n');
    expect((await readBackupHeader(file))?.attachments).toBe(false);
    expect(await readBackupHeader(fixture([{ _id: 'legacy' }], false))).toBeNull();
  });
});

describe('database discovery', () => {
  it('includes system databases only for explicit full-server scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['_users', 'default', 'eddo_user_walterra'],
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await discoverBackupDatabases('http://admin:secret@localhost:5984')).toEqual([
      'default',
      'eddo_user_walterra',
    ]);
    expect(await discoverBackupDatabases('http://admin:secret@localhost:5984', true)).toEqual([
      '_users',
      'default',
      'eddo_user_walterra',
    ]);
    expect(fetchMock.mock.calls[0][0]).not.toContain('secret');
  });
  it('fails closed when discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(discoverBackupDatabases('http://localhost:5984')).rejects.toThrow('403');
  });
});
