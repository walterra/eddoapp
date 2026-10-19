import { createHash } from 'node:crypto';
import fs from 'node:fs';
import readline from 'node:readline';
import { z } from 'zod';

export const backupHeaderSchema = z.object({
  name: z.literal('@cloudant/couchbackup'),
  version: z.string(),
  mode: z.enum(['full', 'shallow']),
  attachments: z.boolean().default(false),
});
export type BackupHeader = z.infer<typeof backupHeaderSchema>;
export interface BackupDocument extends Record<string, unknown> {
  _id: string;
  _rev?: string;
}
export interface BackupInspection {
  header: BackupHeader | null;
  documents: number;
  revisions: Set<string>;
  attachments: number;
  errors: string[];
}
export type DocumentVisitor = (document: BackupDocument) => void | Promise<void>;

/** Validates and visits one decoded document batch. */
async function visitBatch(value: unknown, visit: DocumentVisitor): Promise<void> {
  const documents: unknown[] = Array.isArray(value) ? value : [value];
  const schema = z.object({ _id: z.string().min(1), _rev: z.string().optional() }).passthrough();
  for (const document of documents) {
    const parsed = schema.safeParse(document);
    if (!parsed.success) throw new Error('Document missing _id or invalid _rev');
    await visit(parsed.data);
  }
}

/** Streams decoded document batches without splitting UTF-8 sequences. */
export async function visitBackup(
  file: string,
  visit: DocumentVisitor,
): Promise<BackupHeader | null> {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let header: BackupHeader | null = null;
  let first = true;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const value: unknown = JSON.parse(line);
      const parsed = first ? backupHeaderSchema.safeParse(value) : null;
      first = false;
      if (parsed?.success) {
        header = parsed.data;
        continue;
      }
      await visitBatch(value, visit);
    }
  } finally {
    lines.close();
    input.destroy();
  }
  return header;
}

/** Reads the archive header without loading its document batches. */
export async function readBackupHeader(file: string): Promise<BackupHeader | null> {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const parsed = backupHeaderSchema.safeParse(JSON.parse(line));
      return parsed.success ? parsed.data : null;
    }
    return null;
  } finally {
    lines.close();
    input.destroy();
  }
}

/** Checks inline attachment data before allowing an archive to restore. */
function inspectAttachments(
  document: BackupDocument,
  result: BackupInspection,
  decodedDigests: Readonly<Record<string, string>>,
): void {
  if (!document._attachments) return;
  const attachments = z
    .record(z.string(), z.object({ data: z.string(), digest: z.string().optional() }).passthrough())
    .safeParse(document._attachments);
  if (!attachments.success) {
    result.errors.push(`${document._id}: attachment body missing or invalid`);
    return;
  }
  for (const attachment of Object.values(attachments.data)) {
    result.attachments++;
    const data = Buffer.from(attachment.data, 'base64');
    if (data.toString('base64') !== attachment.data)
      result.errors.push(`${document._id}: invalid attachment base64`);
    const digest = `md5-${createHash('md5').update(new Uint8Array(data)).digest('base64')}`;
    if (attachment.digest && digest !== (decodedDigests[attachment.digest] ?? attachment.digest))
      result.errors.push(`${document._id}: attachment digest mismatch`);
  }
}

/** Validates document identities, attachment payloads, and archive structure. */
export async function inspectBackup(
  file: string,
  decodedDigests: Readonly<Record<string, string>> = {},
): Promise<BackupInspection> {
  const result: BackupInspection = {
    header: null,
    documents: 0,
    revisions: new Set(),
    attachments: 0,
    errors: [],
  };
  try {
    result.header = await visitBackup(file, (document) => {
      result.documents++;
      const key = `${document._id}@${document._rev ?? ''}`;
      if (result.revisions.has(key)) result.errors.push(`Duplicate revision: ${key}`);
      result.revisions.add(key);
      inspectAttachments(document, result, decodedDigests);
    });
    if (!result.header && result.documents === 0) result.errors.push('Backup file is empty');
    if (result.attachments && !result.header?.attachments)
      result.errors.push('Archive header does not enable attachments');
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

/** Hashes an archive without loading it into memory. */
export async function hashBackup(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
