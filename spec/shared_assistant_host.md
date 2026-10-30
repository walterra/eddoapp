# Shared assistant host

Runs internal web admission, Telegram requests, and scheduled reports through one per-account runtime cache.
The existing Telegram process remains the sole journal owner. No additional assistant process starts.
The [authenticated web API](shared_assistant_web_api.md) forwards browser requests to this host and streams projection invalidations.

## Configuration

| Variable                   | Behavior                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| `ASSISTANT_INTERNAL_TOKEN` | Enables internal HTTP transport; requires at least 32 characters |
| `ASSISTANT_INTERNAL_PORT`  | Selects the loopback port; defaults to `3003`                    |
| `TELEGRAM_BOT_TOKEN`       | Enables Telegram transport, polling, and scheduled reports       |

Startup requires at least one transport token and valid model-provider credentials.
Without `ASSISTANT_INTERNAL_TOKEN`, Telegram continues without an HTTP listener.
Without `TELEGRAM_BOT_TOKEN`, the same process runs the internal host without polling or scheduling Telegram reports.
Omit unused token variables rather than setting empty strings.

Generate an independent service secret with `openssl rand -hex 32` and store it in server configuration.
Never expose this secret through Vite variables, browser bundles, URLs, or logs.
The service secret authorizes account assertions from a trusted backend; it is not an end-user credential.
The web API must authenticate the user and derive the account before forwarding requests.
Public web routes authenticate application JWTs and derive the account before calling these internal endpoints.

The operator starts the existing process with `pnpm dev:telegram-bot` from the repository root.
Startup binds HTTP to `127.0.0.1` only. The initial transport supports callers on the same host/network namespace.
It provides no public listener, CORS access, TLS termination, remote-container routing, or automatic failover.

## Ownership and recovery

Keep exactly one owner process for each database set. Stop the old process before starting its replacement.
Listener port exclusivity is not a journal ownership or fencing protocol.
Never open journals inside web-api or start another host on a different port against the same databases.

Recovery includes active accounts with current MCP credentials, including accounts without Telegram links.
Concurrent channel requests share one opening promise and the existing native conversation queue.
Failed or closed handles leave the cache; the 30-second recovery cycle retries opening.
Admission and status reject requests after host shutdown begins.
Shutdown closes internal transport before closing journals and MCP dispatch.

Web-only accounts require no fabricated Telegram identifiers.
Existing Telegram owner pins remain mandatory; account linking does not transfer journal ownership.
Adding or removing a pin requires the reviewed migration described in [Durable operations](durable_telegram_operations.md).
Without Telegram credentials, pending Telegram replies follow existing bounded unavailable-delivery behavior.
Keep Telegram credentials configured when existing linked accounts require Telegram delivery.

## Internal protocol

Every endpoint requires `Authorization: Bearer <ASSISTANT_INTERNAL_TOKEN>`.
Tokens in query parameters or end-user JWTs do not authenticate this service.
All responses use `Cache-Control: no-store`. Failures omit credentials, prompts, model responses, and infrastructure diagnostics.

### Admit a web message

`POST /internal/assistant/admit` with `Content-Type: application/json`:

```json
{
  "username": "alice",
  "requestId": "70f72756-993e-4cae-8108-f6b723391ae1",
  "text": "List tasks"
}
```

The host resolves the active conversation, timestamps, five-minute deadline, and web source.
It namespaces the durable identifier as `web:<username>:<requestId>`.
The UUID identifies one logical submission; transport retries reuse it.
Changing message content under an accepted identifier returns `409`.
Retries return the original conversation identity, including after `/new`.

Admission returns `202` after durable acceptance, without waiting for generation or delivery:

```json
{
  "requestId": "web:alice:70f72756-993e-4cae-8108-f6b723391ae1",
  "conversationId": "assistant_conversation_default",
  "status": "queued"
}
```

The status can already reflect later progress when the response arrives.
Body limits apply to actual streamed bytes: 32 KiB total and 8,000 text characters.
Unknown fields, including client-selected conversation IDs, channels, timestamps, and deadlines, fail validation.

### Read durable status

`POST /internal/assistant/status` with the same authentication and JSON content type:

```json
{
  "username": "alice",
  "requestId": "web:alice:70f72756-993e-4cae-8108-f6b723391ae1"
}
```

Returns the persisted request identity and current state from the existing owner.
States include `queued`, `working`, `delivering`, `projecting`, `completed`, `failed`, and `aborted`.
Native queued submissions report `queued`, including behind another channel's generation.
Unknown requests return `404`; cross-account request identifiers return `403`.
Status reads do not admit messages, repeat tools, or return private journal records.

### Failure statuses

- `400`: malformed JSON, invalid fields, or unsupported content type.
- `401`: missing or invalid service token.
- `403`: inactive account, missing MCP credentials, or cross-account status access.
- `404`: unknown endpoint or request.
- `405`: unsupported method.
- `409`: accepted request identifier reused for a different payload.
- `413`: request body exceeds its byte limit.
- `503`: host, registry, provider configuration, storage, or MCP initialization unavailable.

Transport failure after admission leaves the outcome unknown to the caller. Query status or retry the same UUID.
Never automatically generate a replacement UUID after an ambiguous failure.
A failed generation can follow successful admission; only terminal request status establishes its outcome.

## Verification

Run from the repository root:

```bash
pnpm test:unit
pnpm test:integration:durable
pnpm check:commit
```

Tests cover authentication, bounded bodies, sanitized errors, account isolation, web-only startup, shared ownership, and recovered status.
Scripted providers and disposable CouchDB avoid model API calls.
