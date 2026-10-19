// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recreateDatabase } from './backup-utils.js';
import type { RestoreConfig } from './restore-interactive-prompts.js';
import { performRestore } from './restore-interactive.js';

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
