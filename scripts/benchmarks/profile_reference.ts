import 'dotenv-mono/load';
import nano, { type DocumentScope } from 'nano';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defaultProfile } from './day_paging_fixture';
import { analyzeReference, summarize } from './reference_statistics';
import type { ReferenceStatistics, ReferenceTodo } from './reference_types';

/** Reads documents in bounded pages without requesting attachment bodies. */
async function readDocuments(db: DocumentScope<ReferenceTodo>): Promise<ReferenceTodo[]> {
  const documents: ReferenceTodo[] = [];
  let startkey: string | undefined;
  while (true) {
    const page = await db.list({
      include_docs: true,
      limit: 500,
      ...(startkey ? { startkey, skip: 1 } : {}),
    });
    for (const row of page.rows) {
      if (row.doc && !row.id.startsWith('_design/')) documents.push(row.doc);
    }
    if (page.rows.length < 500) return documents;
    startkey = page.rows.at(-1)!.id;
    console.log(`profile: scanned ${documents.length} documents (contents withheld)`);
  }
}

/** Profiles the configured source read-only and persists aggregate statistics only. */
async function main(): Promise<void> {
  const url = process.env.COUCHDB_URL;
  if (!url) throw new Error('Missing COUCHDB_URL');
  const username = process.argv[2] ?? 'walterra';
  if (!/^[a-z0-9_]+$/.test(username)) throw new Error('Invalid reference username');
  const prefix = process.env.DATABASE_PREFIX ?? 'eddo';
  const couch = nano(url);
  const name = `${prefix}_user_${username}`;
  const db = couch.db.use<ReferenceTodo>(name);
  const before = await db.info();
  const documents = await readDocuments(db);
  const todos = documents.filter(
    (doc) => /^alpha[1-4]$/.test(doc.version ?? '') && typeof doc.due === 'string',
  );
  const statistics = analyzeReference(todos);
  const attachmentName = `${prefix}_attachments_${username}`;
  const attachmentInfo = await couch.db.get(attachmentName);
  const attachmentDocs = await readDocuments(couch.db.use<ReferenceTodo>(attachmentName));
  const attachmentLengths = attachmentDocs.flatMap((doc) =>
    Object.values(doc._attachments ?? {}).map((attachment) => attachment.length ?? 0),
  );
  const after = await db.info();
  const report = {
    capturedAt: new Date().toISOString(),
    source: name,
    stableDuringScan: JSON.stringify(before.update_seq) === JSON.stringify(after.update_seq),
    database: {
      docCount: before.doc_count,
      deletedCount: before.doc_del_count,
      sizes: before.sizes,
    },
    nonTodoDocuments: documents.length - todos.length,
    statistics,
    attachments: {
      docCount: attachmentInfo.doc_count,
      deletedCount: attachmentInfo.doc_del_count,
      sizes: attachmentInfo.sizes,
      lengths: summarize(attachmentLengths),
    },
  };
  saveReport(username, report);
  saveCalibration(username, statistics);
}

/** Saves aggregate-only reports outside version control. */
function saveReport(username: string, report: unknown): void {
  const directory = resolve('benchmark-results/reference');
  mkdirSync(directory, { recursive: true });
  const path = `${directory}/${username}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`profile: aggregate report saved to ${path}`);
}

/** Writes a reusable synthetic profile from the measured distributions. */
function saveCalibration(username: string, statistics: ReferenceStatistics): void {
  const profile = {
    ...defaultProfile,
    name: `${username}-aggregate-calibrated`,
    totalTodos: statistics.totalTodos,
    days: Object.keys(statistics.dueDates).length,
    contexts: statistics.contexts,
    descriptionBytes: statistics.descriptionBytes.median,
    activityEntries: statistics.activityEntries.median,
    calibration: statistics,
  };
  const path = resolve(`benchmark-results/reference/${username}-profile.json`);
  writeFileSync(path, JSON.stringify(profile, null, 2));
  console.log(`profile: calibrated synthetic configuration saved to ${path}`);
}

main().catch(() => {
  console.error('Read-only profiling failed; source credentials and contents omitted');
  process.exitCode = 1;
});
