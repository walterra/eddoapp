// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupDatabase, type SchedulerLogger } from './backup-scheduler-helpers.js';
import { createBackupScheduler } from './backup-scheduler.js';
import { backup } from './backup.js';
import { discoverBackupDatabases } from './backup_transport.js';
import { verifyBackup } from './verify-backup.js';

vi.mock('./backup.js', () => ({ backup: vi.fn() }));
vi.mock('./verify-backup.js', () => ({ verifyBackup: vi.fn() }));
vi.mock('@eddo/core-server/config', () => ({
  validateEnv: () => ({ COUCHDB_URL: 'http://localhost:5984' }),
}));
vi.mock('./backup_transport.js', () => ({ discoverBackupDatabases: vi.fn() }));
const logger: SchedulerLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
afterEach(() => vi.resetAllMocks());

describe('backup failure reporting', () => {
  it('marks failed verification as a failed backup', async () => {
    vi.mocked(backup).mockResolvedValue('/private/new.json');
    vi.mocked(verifyBackup).mockResolvedValue(false);
    expect(await backupDatabase('eddo_test', '/private', true, logger)).toMatchObject({
      success: false,
      verified: false,
    });
    expect(backup).toHaveBeenCalledWith('eddo_test', '/private');
  });
  it('does not fall back to an older backup after failure', async () => {
    vi.mocked(backup).mockRejectedValue(new Error('failed'));
    expect(await backupDatabase('eddo_test', '/private', true, logger)).toMatchObject({
      success: false,
    });
    expect(verifyBackup).not.toHaveBeenCalled();
  });
  it('reports failed discovery rather than a successful empty cycle', async () => {
    vi.mocked(discoverBackupDatabases).mockRejectedValue(new Error('unavailable'));
    const scheduler = createBackupScheduler({ logger, applyRetention: false });
    expect(await scheduler.runBackupCycle()).toEqual([expect.objectContaining({ success: false })]);
  });
  it('includes system and non-eddo databases in explicit full-server scope', async () => {
    vi.mocked(discoverBackupDatabases).mockResolvedValue(['_users', 'default', 'eddo_test']);
    vi.mocked(backup).mockImplementation(async (name) => `/private/${name}.json`);
    vi.mocked(verifyBackup).mockResolvedValue(true);
    const scheduler = createBackupScheduler({ logger, allDatabases: true, applyRetention: false });
    const results = await scheduler.runBackupCycle();
    expect(discoverBackupDatabases).toHaveBeenCalledWith('http://localhost:5984', true);
    expect(results.map((result) => result.database)).toEqual(['_users', 'default', 'eddo_test']);
  });
});
