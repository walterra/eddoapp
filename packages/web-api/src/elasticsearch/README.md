# Elasticsearch sync

CouchDB remains the source of truth. The web API indexes todos and audit records into Elasticsearch.

## Change delivery

Nano runs in `wait` mode. Each batch pauses the reader until indexing and checkpoint persistence succeed.
The listener consumes only batch events, then resumes the same reader instance.
Failed batches retain their checkpoint and retry after five seconds. Bulk failures retain queued operations.
Todo checkpoints reside in index mapping metadata as `_meta.last_seq`.

## Recover stalled search

Restart the web API after installing the sync fix. Existing todo indices resume from their saved checkpoints.
The reader drains subsequent pages, including todos missing since the previous first-page stall.
Audit records receive a full sync at startup.
Compare CouchDB `update_seq` with the todo index checkpoint after catch-up.
Check known recent todo IDs in Elasticsearch to verify recovery.

Startup updates existing audit mappings and templates with `ignore_above: 4096` for flattened snapshots and metadata.
Long values remain in `_source` but are excluded from keyword indexing, avoiding oversized-term failures.

Run focused regression tests from the repository root:

```sh
pnpm vitest:run packages/web-api/src/elasticsearch/sync-changes-listener.test.ts packages/web-api/src/elasticsearch/sync-batch.test.ts packages/web-api/src/elasticsearch/index-manager.test.ts
```
