# Eddo MCP server

Runs a standalone Hono service using the official MCP TypeScript SDK v2.
Exposes `/mcp` on `MCP_SERVER_PORT` (default `3001`), bound to `MCP_HOST` (default `localhost`).

## Protocol and authentication

Accepts MCP revision `2026-07-28`. Rejects legacy protocol requests; no initialization handshake or transport sessions exist.
Requires `Authorization: Bearer <api-key>` or `X-API-Key` for every MCP request.
Creates request-local identity, tracing context, tool registrations, and mutation-receipt bindings.
Shares CouchDB and optional Elasticsearch clients across requests.
Always exposes `searchTodos` to keep the tool catalog stable across environments.
Without Elasticsearch, search returns a structured `Search unavailable` error instead of disappearing from discovery.
Revalidates API keys and account status against the registry on every request; authentication results are not cached.
Rejects conflicting API-key and bearer headers, malformed bearer headers, and credentials exceeding 512 characters.

## Request limits

- JSON request bodies: 8 MiB, allowing base64 encoding of supported 5 MiB attachments.
- Concurrent authenticated exchanges: 32 per process; overload returns `503` with `Retry-After: 1`.
- Todo list limit: integer from 1 to 500.
- Search limit: integer from 1 to 100.

Localhost binds enforce Host and Origin validation through the official Hono helpers.
Set `MCP_ALLOWED_HOSTS` to comma-separated hostnames when binding `MCP_HOST` to `0.0.0.0` or `::`.
Include hostnames used by container clients, such as `host.docker.internal`, when applicable.
Host allowlists contain hostnames, not URLs or ports. Non-browser clients require no Origin header.

Uses JSON responses and closes each request handler after execution.
Tool spans record error status without raw exception messages or credential-bearing error payloads.
Malformed operation IDs return `400`; receipt stores remain scoped to the authenticated database.

## Tool contracts

Every tool publishes a shared output-envelope schema and returns matching `structuredContent` and JSON text.
The envelope preserves `summary`, domain `data`, `metadata`, and optional pagination.
Domain payloads remain JSON values; the shared schema does not model every todo or report field.
`getServerInfo` returns its documentation in `data.markdown`.

Domain failures, thrown exceptions, and invalid handler responses return `isError: true` with a safe error envelope.
Error envelopes never expose raw handler exceptions. Mutation failures instruct clients to inspect state before retrying.
Receipts continue storing original domain responses; the transport constructs structured results after receipt execution.

Read-only tools advertise read-only, idempotent behavior. `fetchUrl` advertises open-world access; other reads remain closed-world.
Mutation tools advertise conservative destructive behavior and no unconditional idempotency.
Annotations guide clients; they do not replace server authorization or receipt protection.

First-party clients still using SDK v1 require migration before deployment.

## Chat URL capture

Chat saves public URLs through `fetchUrl`, then passes `urlCaptureRef` to `createTodo`.
The server appends extracted Markdown verbatim to the todo description after any user notes.
The submitted URL remains in `link`; explicit user titles, contexts, tags, and dates remain unchanged.
URL-only saves default to `read-later`, `gtd:someday`, and today's date.
Questions containing URLs do not trigger todo creation.
Extraction failures fall back to saving the link with a domain/path title.

Stores provenance in namespaced todo metadata:

- `web:sourceUrl`, `web:fetchedAt`, `web:provider`, and `web:truncated`.
- `web:title`, `web:resolvedUrl`, `web:description`, `web:publishedAt`, and `web:author` when Reader supplies them.

Reader responses vary by page and deployment. Missing metadata stays absent.
Page text, titles, and metadata remain untrusted content, not agent instructions.

### Reader configuration

Set these variables on the MCP server:

| Variable                 | Default             | Purpose                                       |
| ------------------------ | ------------------- | --------------------------------------------- |
| `JINA_READER_URL`        | `https://r.jina.ai` | Hosted or self-hosted Reader endpoint         |
| `JINA_API_KEY`           | unset               | Optional Reader authentication                |
| `JINA_MAX_CONTENT_BYTES` | `200000`            | Markdown byte limit, between 1024 and 1000000 |

Hosted Reader receives submitted URLs. Never submit private links, credentials, or signed URLs.
Validation rejects private/reserved addresses, credentials, unusual source ports, and obvious secret query parameters.
Secret detection is heuristic; it cannot identify every confidential URL.
No source cookies or authentication headers are forwarded.
The configured Reader must enforce redirect and DNS-rebinding protections and restrict private-network egress.
Eddo checks initial DNS results and reported final URLs; it cannot inspect Reader's intermediate requests.
Use a trusted Reader deployment. See [Jina Reader documentation](https://jina.ai/reader/).

DNS validation times out after five seconds. Reader HTTP requests time out after 30 seconds.
Upstream JSON responses cannot exceed 4 MB.
Oversized Markdown receives an explicit truncation marker and `web:truncated=true`.
Tool output includes only a 2000-character preview, not the entire stored document.
Captures remain account-scoped for one hour, with at most 100 entries per process.
References expire on restart or eviction; fetch again before retrying creation.
Extraction retries are allowed in interactive Durable sessions, but scheduled reports cannot fetch URLs.
No HTML, image assets, or authenticated browser state are archived.

## Development

Run commands from the repository root:

- Build: `pnpm build:mcp-server`
- Tool tests: `pnpm vitest:run packages/mcp_server/src/tools`
- Integration tests: `pnpm test:integration:mcp-server` (requires Docker and migrated test clients)

The user starts development servers with `pnpm dev:mcp-server`.

## Coordinated Rollout

The root production web image does not package this standalone service.
Build server artifacts and install workspace production dependencies for the MCP service separately.
Start its package from the repository root with `pnpm --filter @eddo/mcp-server start`.

1. Complete repository checks and disposable-database integration tests before release.
2. Back up user databases, mutation-receipt databases, and complete Durable runtime journals.
3. Stop the bot and chat containers; drain MCP writes before replacing the service.
4. Deploy the current-protocol MCP build and configure its host allowlist for container access.
5. Deploy the migrated bot and rebuild/recreate skill containers together.
6. Verify authenticated discovery, reads, reports, and receipt-protected mutation replay.

Run exactly one bot owner per runtime database set.
Roll back server, bot, and distributed skills together; mixed protocol generations are unsupported.
Inspect pending mutation receipts before retrying interrupted writes. Never delete receipts to force a retry.
See [skill image packaging](../../docker/pi-coding-agent/README.md#reproducible-todo-skill-packaging).
