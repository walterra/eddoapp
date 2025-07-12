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
- MCP server for external integrations

## Commands

- **Build**: `pnpm build`
- **Dev**: `pnpm dev`
- **Lint**: `pnpm lint`
- **Format**: `pnpm format`
- **Check**: `pnpm tsc:check`
- **Test**: `pnpm test`
- **Test (integration)**: `pnpm test:integration`
- **Test (e2e)**: `pnpm test:e2e`
- **Test (all)**: `pnpm test:all`

## Structure

packages/client/src/index.tsx        # React frontend entry
packages/server/src/mcp-server.ts    # MCP server
packages/telegram-bot/src/index.ts   # Telegram bot
packages/shared/src/                 # Shared types/utils
scripts/                             # CLI tools