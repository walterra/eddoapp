# Eddo MCP server

Runs a standalone Hono service using the official MCP TypeScript SDK v2.
Exposes `/mcp` on `MCP_SERVER_PORT` (default `3001`), bound to `MCP_HOST` (default `localhost`).

## Protocol and authentication

Accepts MCP revision `2026-07-28`. Rejects legacy protocol requests; no initialization handshake or transport sessions exist.
Requires `Authorization: Bearer <api-key>` or `X-API-Key` for every MCP request.
Creates request-local identity, tracing context, tool registrations, and mutation-receipt bindings.
Shares CouchDB and optional Elasticsearch clients across requests.
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

Read-only tools advertise read-only, idempotent, closed-world behavior.
Mutation tools advertise conservative destructive behavior and no unconditional idempotency.
Annotations guide clients; they do not replace server authorization or receipt protection.

First-party clients still using SDK v1 require migration before deployment.

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
