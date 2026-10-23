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

Preserves existing text tool responses during migration. Structured output contracts follow separately.
First-party clients still using SDK v1 require migration before deployment.

## Development

Run commands from the repository root:

- Build: `pnpm build:mcp-server`
- Tool tests: `pnpm vitest:run packages/mcp_server/src/tools`
- Integration tests: `pnpm test:integration:mcp-server` (requires Docker and migrated test clients)

The user starts development servers with `pnpm dev:mcp-server`.
