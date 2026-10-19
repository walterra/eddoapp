import fs from 'node:fs';
import { z } from 'zod';
import { verifySourceAttachments } from './backup_attachments.js';
import { hashBackup, inspectBackup, type BackupInspection } from './backup_inspection.js';
import type { DatabaseSnapshot } from './backup_transport.js';

const metadataSchema = z.object({
  format: z.literal(1),
  database: z.string(),
  createdAt: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  documentCount: z.number().int().nonnegative(),
  updateSequence: z.union([z.string(), z.number()]),
  revisions: z.array(z.string()),
  security: z.record(z.string(), z.unknown()),
  decodedAttachmentDigests: z.record(z.string(), z.string()).default({}),
});
export type BackupMetadata = z.infer<typeof metadataSchema>;

/** Returns the archive's security and integrity sidecar path. */
export function metadataPath(file: string): string {
  return `${file}.metadata.json`;
}

/** Loads validated metadata; legacy archives have no sidecar. */
export function readBackupMetadata(file: string): BackupMetadata | null {
  const sidecar = metadataPath(file);
  if (!fs.existsSync(sidecar)) return null;
  return metadataSchema.parse(JSON.parse(fs.readFileSync(sidecar, 'utf8')));
}

/** Checks the source inventory against committed archive revisions. */
export function assertInventory(snapshot: DatabaseSnapshot, inspection: BackupInspection): void {
  if (inspection.errors.length) throw new Error(inspection.errors.join('; '));
  if (snapshot.inventory.rows.length !== snapshot.info.doc_count)
    throw new Error('Source inventory count changed');
  const missing = snapshot.inventory.rows.filter(
    (row) => !inspection.revisions.has(`${row.id}@${row.value.rev}`),
  );
  if (missing.length) throw new Error(`Archive missing ${missing.length} source revisions`);
}

/** Writes private integrity and security metadata after archive validation. */
export async function writeBackupMetadata(
  file: string,
  snapshot: DatabaseSnapshot,
  databaseUrl: string,
): Promise<void> {
  const decodedAttachmentDigests = await verifySourceAttachments(file, databaseUrl);
  const inspection = await inspectBackup(file, decodedAttachmentDigests);
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  assertInventory(snapshot, inspection);
  const metadata: BackupMetadata = {
    format: 1,
    database,
    decodedAttachmentDigests,
    createdAt: new Date().toISOString(),
    sha256: await hashBackup(file),
    documentCount: snapshot.info.doc_count,
    updateSequence: snapshot.info.update_seq,
    revisions: snapshot.inventory.rows.map((row) => `${row.id}@${row.value.rev}`),
    security: snapshot.security,
  };
  fs.writeFileSync(metadataPath(file), JSON.stringify(metadata, null, 2), {
    mode: 0o600,
    flag: 'wx',
  });
}

/** Checks metadata integrity and completeness before destructive restore preparation. */
export async function validateBackupArchive(file: string): Promise<BackupInspection> {
  const metadata = readBackupMetadata(file);
  const inspection = await inspectBackup(file, metadata?.decodedAttachmentDigests);
  if (metadata) {
    if ((await hashBackup(file)) !== metadata.sha256)
      inspection.errors.push('Archive checksum mismatch');
    if (metadata.revisions.length !== metadata.documentCount)
      inspection.errors.push('Metadata inventory count mismatch');
    if (metadata.revisions.some((revision) => !inspection.revisions.has(revision)))
      inspection.errors.push('Archive missing metadata revisions');
  }
  if (inspection.errors.length) throw new Error(inspection.errors.join('; '));
  return inspection;
}
