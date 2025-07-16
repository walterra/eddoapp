# Project: Eddo App - GTD Todo & Time Tracking

GTD-inspired todo and time tracking application with offline-first architecture.
TypeScript monorepo with React frontend, MCP server, and Telegram bot.

## Features

- Offline-first PouchDB storage with CouchDB sync
- Calendar week-based task organization
- GTD contexts (work, private, etc.) with Kanban layout
- Time tracking with start/pause functionality
- Repeating tasks and tag system
- Telegram bot with AI agent (Claude)
- AI memory system via tagged todos (user:memory) for context-aware conversations
- MCP server for external integrations

## Commands

- **Build**: `pnpm build`
- **Dev**: `pnpm dev` (never run this yourself, the user will do this for you)
- **Lint**: `pnpm lint`
- **Format**: `pnpm format`
- **Check**: `pnpm tsc:check`
- **Test**: `pnpm test`
- **Test (integration)**: `pnpm test:integration`
- **Test (e2e)**: `pnpm test:e2e`
- **Test (all)**: `pnpm test:all`

## Structure

packages/web-client/src/client.tsx # React frontend entry
packages/web-api/src/index.ts # Hono API server entry
packages/mcp_server/src/mcp-server.ts # MCP server
packages/telegram_bot/src/index.ts # Telegram bot
packages/core/src/ # Shared types/utils
scripts/ # CLI tools
