# Eddo MCP server

Runs a standalone Hono service using the official MCP TypeScript SDK v2.
Exposes `/mcp` on `MCP_SERVER_PORT` (default `3001`), bound to `MCP_HOST` (default `localhost`).

## Protocol and authentication

Accepts MCP revision `2026-07-28`. Rejects legacy protocol requests; no initialization handshake or transport sessions exist.
Requires `Authorization: Bearer <api-key>` or `X-API-Key` for every MCP request.
Creates request-local identity, tracing context, tool registrations, and mutation-receipt bindings.
Shares CouchDB and optional Elasticsearch clients across requests.

Preserves existing text tool responses during migration. Structured output contracts follow separately.
First-party clients still using SDK v1 require migration before deployment.

## Development

Run commands from the repository root:

- Build: `pnpm build:mcp-server`
- Tool tests: `pnpm vitest:run packages/mcp_server/src/tools`
- Integration tests: `pnpm test:integration:mcp-server` (requires Docker and migrated test clients)

The user starts development servers with `pnpm dev:mcp-server`.
