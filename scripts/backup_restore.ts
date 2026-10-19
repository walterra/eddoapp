import couchbackup from '@cloudant/couchbackup';
import fs from 'node:fs';
import { z } from 'zod';
import { createRestoreOptions, type RestoreOptions } from './backup-utils.js';
import { readBackupHeader } from './backup_inspection.js';
import { readBackupMetadata, validateBackupArchive } from './backup_metadata.js';
import { couchRequest } from './backup_transport.js';

/** Restores a prevalidated archive into an already prepared database. */
export async function restoreBackupArchive(
  file: string,
  databaseUrl: string,
  options?: Partial<RestoreOptions>,
): Promise<void> {
  await validateBackupArchive(file);
  const header = await readBackupHeader(file);
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  try {
    await new Promise<void>((resolve, reject) => {
      input.once('error', reject);
      couchbackup.restore(
        input,
        databaseUrl,
        createRestoreOptions({ ...options, attachments: header?.attachments ?? false }),
        (error) => (error ? reject(new Error('CouchDB restore failed')) : resolve()),
      );
    });
  } finally {
    input.destroy();
  }
  await restoreSecurityAndVerify(file, databaseUrl);
}

/** Restores security settings and checks live revisions against the saved inventory. */
async function restoreSecurityAndVerify(file: string, databaseUrl: string): Promise<void> {
  const metadata = readBackupMetadata(file);
  if (!metadata) {
    console.warn(
      'Legacy archive: no security metadata or source inventory; verify restored data separately',
    );
    return;
  }
  const inventory = z
    .object({ rows: z.array(z.object({ id: z.string(), value: z.object({ rev: z.string() }) })) })
    .parse(await couchRequest(databaseUrl, '/_all_docs'));
  const revisions = new Set(inventory.rows.map((row) => `${row.id}@${row.value.rev}`));
  if (
    revisions.size !== metadata.documentCount ||
    metadata.revisions.some((revision) => !revisions.has(revision))
  ) {
    throw new Error('Restored database does not match backup inventory');
  }
  await couchRequest(databaseUrl, '/_security', metadata.security);
}
