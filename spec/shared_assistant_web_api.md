# Shared assistant web API

Exposes the shared assistant through authenticated web-api routes.
Execution stays in the existing [single-owner host](shared_assistant_host.md).
The web API reads application chat projections and forwards submissions over loopback; it never opens an execution journal.
Sandbox/container chat routes remain unchanged.

## Authentication and configuration

Send the existing application JWT through `Authorization: Bearer <jwt>`.
These routes require an expiry claim and reject query-string tokens, including SSE requests.
Use streaming `fetch`, not `EventSource` with credentials embedded in a URL.

The web API revalidates active account status and current MCP credentials for each request.
Streams revalidate before polling and after asynchronous reads, before emitting private state.
The verified JWT supplies the account; message bodies and cursors cannot select another account or database.

Configure the same server-only `ASSISTANT_INTERNAL_TOKEN` and `ASSISTANT_INTERNAL_PORT` in web-api and the existing host process.
The port defaults to `3003`. Never expose the service secret through Vite variables or browser requests.
Without host configuration or connectivity, submission and status return `503`; persisted history remains readable.
Read-only status polling accepts cancellation; browser disconnection never cancels an accepted message or generates a replacement UUID.

## Endpoints

### Fetch active conversation and paginated history

`GET /api/assistant/conversation?limit=30&cursor=<optional-page-cursor>`

Returns:

- `conversation`: active conversation metadata, or `null` before the first conversation exists.
- `messages`: one page in chronological order, with both web and Telegram messages.
- `nextCursor`: opaque cursor for the next older page, or `null`.
- `changeCursor`: durable checkpoint for live projection updates.

The default limit is 30; the maximum is 50.
Pagination uses the complete sequence, timestamp, and document-ID key, preserving ties without duplicate messages.
Cursors bind to the authenticated account and active conversation. `/new` invalidates an earlier conversation's page cursor.
Missing projections return empty history; reads never provision a database or create conversation state.

Read the change checkpoint before the latest history page, then connect the stream from that checkpoint.
Changes racing with the history read can replay; reconcile messages by their stable document IDs.
Do not advance an existing live cursor from an older pagination response.

### Submit one logical message

`POST /api/assistant/messages` with `Content-Type: application/json`:

```json
{
  "requestId": "70f72756-993e-4cae-8108-f6b723391ae1",
  "text": "List tasks"
}
```

Returns `202` and the host's durable request identity, conversation ID, and current status.
The host chooses the active conversation, channel, timestamps, and deadline.
Unknown fields, including `username`, `conversationId`, or a channel selector, return `400`.
Bodies are limited to 32 KiB of actual streamed bytes and 8,000 text characters.

Generate one UUID per logical submission. Reuse it after timeouts, network failures, reloads, and reconnects.
Accepted UUIDs cannot be reused with changed message content; conflicts return `409`.
The web API never automatically retries admission or replaces an ambiguous request ID.
A successful admission does not establish successful generation; inspect durable status and projected history.

### Read durable request status

`GET /api/assistant/requests/<encoded-durable-request-id>`

Use the returned `web:<username>:<uuid>` identifier, encoded as a URL path component.
Status comes from the existing host, including after recovery.
Cross-account or malformed identifiers return `403`; unknown requests return `404`.
Backend diagnostics, tool arguments, and execution-journal records never enter the response.

### Stream resumable updates

`GET /api/assistant/stream?cursor=<optional-change-cursor>&requestIds=<optional-comma-separated-durable-ids>`

Send the JWT in the Authorization header.
Resume with either the `cursor` query parameter or `Last-Event-ID`; conflicting values return `400`.
Track at most ten account-scoped request IDs per stream.

| SSE event         | Behavior                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| `reset`           | Refetch the latest conversation/history page; establishes a new durable checkpoint |
| `history-change`  | Invalidates history using an assistant document ID; contains no message body       |
| `checkpoint`      | Advances the durable CouchDB resume cursor, including across empty batches         |
| `request-status`  | Refreshes a tracked request from persisted host state                              |
| `request-missing` | Reports an unknown tracked request without admitting replacement work              |
| `unavailable`     | Reports a temporarily unavailable host while projection updates continue           |
| `error`           | Reports a bounded authorization or availability error before ending the stream     |

History events replay from the account's persisted CouchDB changes feed, not an in-memory buffer.
CouchDB filters assistant document versions; sandbox documents and raw message bodies never enter the event stream.
Tracked statuses are current durable snapshots, recomputed on reconnect rather than replayed as an event log.
A rejected CouchDB checkpoint emits `reset` and a fresh checkpoint instead of silently skipping history.

The stream uses five-second long polling and a one-second pause between batches.
Client disconnect, JWT expiry, and the five-minute connection lifetime cancel polling and release stream capacity.
Reconnect with the last checkpoint and a current JWT after a normal stream closure.
Slow readers apply backpressure through awaited SSE writes; no background event queue accumulates.

This endpoint provides invalidations and lifecycle snapshots, not token streaming.
Accepted user messages currently enter application history with completed exchange projection.
Admission-time message projection and pending-request reconciliation remain in implementation step 6.

## Limits and failures

Limits apply per web-api process:

- Ten submissions per account per minute.
- 120 read requests per account per minute.
- Two concurrent streams per account and 100 streams globally.
- Bounded rate-limit accounting for at most 10,000 account keys.

Rate-limited requests return `429` with `Retry-After: 60`.
Responses use `Cache-Control: no-store` and bounded error codes.
Infrastructure failures and invalid internal receipts return `503`, without leaking host credentials or provider messages.
An internal service-authentication failure maps to `503`, not a misleading browser login failure.

## Verification

Run from the repository root:

```bash
pnpm test:unit
pnpm test:integration:durable
pnpm check:commit
```

The durable integration command includes web projection pagination and SSE replay against disposable CouchDB.
Tests use scripted providers or no model provider; they make no paid model calls.
