import { createHash } from 'node:crypto';
import { createProjectedParser } from '../packages/core-shared/src/validation/projected_parser.js';
import {
  createSchemaParser,
  map,
  obj,
  str,
} from '../packages/core-shared/src/validation/schema_parser.js';
import { visitBackup, type BackupDocument } from './backup_inspection.js';
import { couchRequest } from './backup_transport.js';

const attachmentsSchema = createSchemaParser(
  map(obj({ data: str(), digest: str() }, { open: true })),
);
const sourceSchema = createProjectedParser(obj({ _attachments: attachmentsSchema.schema }));
export type DecodedAttachmentDigests = Record<string, string>;

/** Checks one document's decoded attachment bytes against its immutable source revision. */
async function verifyDocumentAttachments(
  document: BackupDocument,
  databaseUrl: string,
  digests: DecodedAttachmentDigests,
): Promise<void> {
  const suffix = `/${encodeURIComponent(document._id)}?rev=${encodeURIComponent(document._rev ?? '')}&attachments=true`;
  const source = sourceSchema.parse(await couchRequest(databaseUrl, suffix));
  const archived = attachmentsSchema.parse(document._attachments);
  if (Object.keys(source._attachments).length !== Object.keys(archived).length)
    throw new Error('Source attachment count mismatch');
  for (const [name, attachment] of Object.entries(archived)) {
    const expected = source._attachments[name];
    if (!expected || expected.data !== attachment.data || expected.digest !== attachment.digest)
      throw new Error('Source attachment bytes mismatch');
    digests[attachment.digest] = `md5-${createHash('md5')
      .update(new Uint8Array(Buffer.from(attachment.data, 'base64')))
      .digest('base64')}`;
  }
}

/** Verifies source bytes without retaining attachment payloads across document batches. */
export async function verifySourceAttachments(
  file: string,
  databaseUrl: string,
): Promise<DecodedAttachmentDigests> {
  const digests: DecodedAttachmentDigests = {};
  await visitBackup(file, async (document) => {
    if (document._attachments) await verifyDocumentAttachments(document, databaseUrl, digests);
  });
  return digests;
}
