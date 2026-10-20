// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestBackupFile } from './backup-utils.js';
import { validateBackupFile, verifyBackup } from './verify-backup.js';

let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-review-'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('published archive selection', () => {
  it('selects the newest exact-database archive without companions or partials', () => {
    const latest = 'eddo_test-2026-10-19T20-00-00-000Z.json';
    for (const file of [
      'eddo_test-2026-10-18T20-00-00-000Z.json',
      latest,
      `${latest}.metadata.json`,
      `${latest}.log`,
      'eddo_test-2026-10-20T20-00-00-000Z.json.partial',
      'eddo_test-extra-2026-10-21T20-00-00-000Z.json',
    ])
      fs.writeFileSync(path.join(directory, file), '[]\n');
    expect(getLatestBackupFile('eddo_test', directory)).toBe(path.join(directory, latest));
  });
});

describe('sidecar verification', () => {
  it.each(['{broken', '{}'])(
    'returns structured failures for invalid metadata: %s',
    async (metadata) => {
      const file = path.join(directory, 'eddo_test-2026-10-19T20-00-00-000Z.json');
      fs.writeFileSync(file, '[{"_id":"a"}]\n');
      fs.writeFileSync(`${file}.metadata.json`, metadata);
      const result = await validateBackupFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      vi.stubEnv('BACKUP_DIR', directory);
      fs.writeFileSync(
        path.join(directory, 'eddo_test-2026-10-18T20-00-00-000Z.json'),
        '[{"_id":"b"}]\n',
      );
      const log = vi.spyOn(console, 'log');
      await expect(verifyBackup()).resolves.toBe(false);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('PASS eddo_test-2026-10-18'));
      log.mockRestore();
    },
  );
});
