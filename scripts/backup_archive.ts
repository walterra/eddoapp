import couchbackup from '@cloudant/couchbackup';
import fs from 'node:fs';
import { finished } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import {
  createBackupOptions,
  ensureBackupDir,
  generateBackupFilename,
  type BackupOptions,
} from './backup-utils.js';
import { metadataPath, writeBackupMetadata } from './backup_metadata.js';
import { snapshotDatabase } from './backup_transport.js';

export interface BackupArchiveOptions {
  databaseUrl: string;
  directory: string;
  options?: Partial<BackupOptions>;
}

/** Writes an attachment-complete archive and publishes only validated backups. */
export async function createBackupArchive(config: BackupArchiveOptions): Promise<string> {
  ensureBackupDir(config.directory);
  const database = decodeURIComponent(new URL(config.databaseUrl).pathname.slice(1));
  const file = generateBackupFilename(database, config.directory);
  const pending = `${file}.partial`;
  const snapshot = await snapshotDatabase(config.databaseUrl);
  await writeArchive(config, pending);
  await writeBackupMetadata(pending, snapshot, config.databaseUrl);
  const after = await snapshotDatabase(config.databaseUrl);
  if (!isDeepStrictEqual(after, snapshot)) {
    throw new Error(
      'Database changed during backup; archive remains .partial; retry when writes are idle',
    );
  }
  fs.renameSync(metadataPath(pending), metadataPath(file));
  if (fs.existsSync(`${pending}.log`)) {
    fs.chmodSync(`${pending}.log`, 0o600);
    fs.renameSync(`${pending}.log`, `${file}.log`);
  }
  fs.renameSync(pending, file);
  return file;
}

/** Waits for both couchbackup completion and output flush before publication. */
async function writeArchive(config: BackupArchiveOptions, file: string): Promise<void> {
  fs.writeFileSync(`${file}.log`, '', { mode: 0o600, flag: 'wx' });
  const output = fs.createWriteStream(file, { mode: 0o600, flags: 'wx' });
  const flushed = finished(output);
  void flushed.catch(() => {});
  try {
    await new Promise<void>((resolve, reject) => {
      output.once('error', reject);
      couchbackup.backup(
        config.databaseUrl,
        output,
        createBackupOptions({
          ...config.options,
          attachments: true,
          mode: 'full',
          logfile: `${file}.log`,
        }),
        (error) =>
          error
            ? reject(new Error('CouchDB backup failed; archive remains incomplete'))
            : resolve(),
      );
    });
    if (!output.writableEnded) output.end();
    await flushed;
  } finally {
    output.destroy();
  }
}
