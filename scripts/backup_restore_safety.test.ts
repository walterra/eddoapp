// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recreateDatabase } from './backup-utils.js';
import type { RestoreConfig } from './restore-interactive-prompts.js';
import { performRestore } from './restore-interactive.js';
import { restore } from './restore.js';

vi.mock('@eddo/core-server/config', () => ({
  validateEnv: vi.fn(() => ({})),
  getCouchDbConfig: vi.fn(() => ({ dbName: 'target' })),
}));
vi.mock('./restore-helpers.js', () => ({
  getRestoreContext: vi.fn((file: string) => ({ restoreFile: file, dbName: 'target' })),
  checkDatabaseForRestore: vi.fn(async () => ({ shouldProceed: true })),
}));

vi.mock('prompts', () => ({ default: vi.fn() }));
vi.mock('ora', () => ({ default: () => ({ start: () => ({ succeed: vi.fn(), fail: vi.fn() }) }) }));
vi.mock('./backup-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./backup-utils.js')>()),
  recreateDatabase: vi.fn(),
}));
let directory: string;
let config: RestoreConfig;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eddo-restore-safety-'));
  const file = path.join(directory, 'backup.json');
  fs.writeFileSync(file, '[{"_id":"a","_rev":"1-a"}]\n');
  config = {
    url: 'http://admin:secret@localhost:5984',
    database: 'target',
    backupFile: file,
    backupDir: directory,
    parallelism: 1,
    timeout: 60000,
    dryRun: false,
    forceOverwrite: true,
  };
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('destructive restore preparation', () => {
  it.each([
    '{"_id":"a","_rev":"1-a"}\n',
    '\n{"name":"@cloudant/couchbackup","version":"2.11.12","mode":"full"}\n[{"_id":"a"}]\n',
    '   \n[{"_id":"a"}]\n',
  ])(
    'rejects engine-incompatible input before either entry point deletes the target: %s',
    async (content) => {
      fs.writeFileSync(config.backupFile!, content);
      await expect(performRestore(config, false)).rejects.toThrow();
      await expect(restore(config.backupFile!, 'target', true)).rejects.toThrow();
      expect(recreateDatabase).not.toHaveBeenCalled();
    },
  );
  it('does not delete the target when final confirmation is declined', async () => {
    vi.mocked(prompts).mockResolvedValue({ finalConfirm: false });
    await performRestore(config, true);
    expect(recreateDatabase).not.toHaveBeenCalled();
  });
  it('does not delete the target when validation fails', async () => {
    fs.writeFileSync(config.backupFile!, '[broken');
    await expect(performRestore(config, false)).rejects.toThrow();
    expect(recreateDatabase).not.toHaveBeenCalled();
  });
  it('does not delete the target in dry-run mode', async () => {
    await performRestore({ ...config, dryRun: true }, false);
    expect(recreateDatabase).not.toHaveBeenCalled();
  });
});
