# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

### Commands to run servers

Never run these commands yourself or kill related processes. The user is responsible for running the server. If you need to run or restart one of these commands, ask the user to do it for you.

- web (client+api): `pnpm dev` (port 3000)
- web client dev only: `pnpm dev:web-client` (port 5173 in dev)
- web api dev only: `pnpm dev:web-api` (port 3000, passes through web-client)
- MCP server dev: `pnpm dev:mcp-server`
- Telegram bot dev: `pnpm dev:telegram-bot`

### Root Level

Use these commands for investigating, testing and linting.
DO NOT cd into packages. you MUST stay in root and run commands like `pnpm test|build` from the repo root.

- IMPORTANT: Use `pnpm logs:tail` to investigate unified logs produced by `pnpm dev`
- Build all packages: `pnpm build` (always run from the repo root, not from individual package dirs)
- Build for production: `pnpm build:production`
- Lint: `pnpm lint`
- Format check: `pnpm lint:format`
- Format fix: `pnpm format`
- Unit tests (default): `pnpm test`
- Unit tests only: `pnpm test:unit`
- Integration tests: `pnpm test:integration`
- E2E tests: `pnpm test:e2e`
- Full test suite: `pnpm test:all`
- CI test suite: `pnpm test:ci`
- Run single test: `pnpm vitest:run src/path/to/file.test.ts`
- TypeScript check: `pnpm tsc:check`
- MCP server test: `pnpm test:mcp` (this lets you run commands against mcp-server)
- Check unused dependencies: `pnpm knip`

### Package-Specific

- Build specific package: `pnpm build:client|api|core|mcp-server|telegram-bot`

### Backup & Restore

- Interactive backup: `pnpm backup:interactive`
- Interactive restore: `pnpm restore:interactive`
- Direct backup: `pnpm backup -- --database <db-name> --output ./backups/`
- Direct restore: `pnpm restore -- --input ./backups/<file>.json --database <db-name>`
- Verify backup: `pnpm backup:verify`

### CLI & Mock Data

- CLI interface: `pnpm cli`
- Test CLI: `pnpm cli:test`
- Populate mock data: `pnpm populate-mock-data`
- Populate mock data (dry run): `pnpm populate-mock-data:dry-run`

## Architecture Overview

This is a GTD-inspired todo and time tracking application built as a monorepo with multiple packages:

- **web-client**: React/TypeScript frontend with PouchDB for offline-first storage (port 5173 in dev)
- **web-api**: Hono API server for authentication and CouchDB proxy (port 3000)
- **core**: Common types, utilities, and data models across packages
- **mcp-server**: MCP (Model Context Protocol) server for external integrations (port 3002)
- **telegram-bot**: Telegram bot with AI agent capabilities using Anthropic Claude

### Key Architectural Patterns

- **Database-Centric**: PouchDB serves as both storage and state management (no Redux/Zustand)
- **Offline-First**: Local browser storage with real-time sync via PouchDB changes feed
- **Versioned Data Model**: Automatic migration system between schema versions (alpha1 → alpha2 → alpha3)
- **Calendar Week View**: UI organized around calendar weeks with date-range queries
- **GTD-Style Contexts**: Todos grouped by context (e.g., "work", "private") in Kanban-style layout

### Data Flow

1. Components access PouchDB directly via `usePouchDb()` hook
2. Database changes trigger React re-renders through changes feed
3. No centralized state store - PouchDB is the source of truth
4. Design documents provide MapReduce views for efficient querying

### Current Data Model (Alpha3)

```typescript
interface TodoAlpha3 {
  _id: string; // ISO timestamp of creation
  active: Record<string, string | null>; // Time tracking entries
  completed: string | null;
  context: string; // GTD context
  description: string;
  due: string; // ISO date string
  link: string | null; // Added in alpha3
  repeat: number | null; // Days
  tags: string[];
  title: string;
  version: 'alpha3';
}
```

### Package Structure

- `packages/web-client/src/`: React frontend application
  - `components/`: React components (flat structure)
  - `hooks/`: Custom React hooks
  - `pages/`: Page components for routing
  - `utils/`: Frontend-specific utilities
- `packages/web-api/src/`: Hono API server
  - `routes/`: API route handlers
  - `middleware/`: Authentication and error handling
  - `config.ts`: Server configuration
- `packages/core/src/`: Shared code across packages
  - `api/versions/`: Data model versions and migration functions
  - `types/`: TypeScript definitions
  - `utils/`: Utility functions with co-located tests
  - `env.ts`: Environment variable validation and helpers
- `packages/mcp_server/src/`: MCP server implementation
  - `tools/`: MCP tool definitions
  - `server.ts`: FastMCP server setup
- `packages/telegram_bot/src/`: Telegram bot with AI agent
  - `agent/`: Simple agent loop implementation
  - `ai/`: Claude integration and persona management
  - `bot/`: Telegram bot handlers and commands
  - `mcp/`: MCP client integration

## Code Style

- IMPORTANT: Prefer functional style with factories instead of object-oriented style
- Use minimal/lightweight TypeScript-style JSDoc to document code
- Use snake_case for filenames
- Use camelCase for variables/functions, PascalCase for components/types
- Single quotes, trailing commas
- Tests use describe/it pattern with Vitest
- Place test files alongside implementation with .test.ts/.test.tsx extension
- Use typed imports and exports with TypeScript
- Use explicit return types for functions
- Follow existing import sorting (uses @trivago/prettier-plugin-sort-imports)
- Use TailwindCSS for styling
- Use try/catch for error handling with console.error
- Use Prettier for formatting with existing config
- **Always run the proper scripts for linting and formatting before manually fixing code style issues**
- TypeScript: do not use `any`.

## Git Rules

- Use CC (Conventional Commit) prefixes for commit messages
- Do not add "Generated with" or "Co-authored" sections to commit messages
- Never git add all files. just add the files related to your current work/tasks.
- **NEVER use `git filter-branch` on the entire repository history** - this rewrites all commits and is extremely destructive
- For removing files from history, prefer simpler solutions:
  - Just delete the files and commit the change
  - Use `git rebase -i` to edit specific recent commits
  - If history rewriting is absolutely necessary, use modern tools like `git filter-repo` with careful consideration
- Always warn about and get explicit confirmation before any operation that rewrites git history

## AI Agent Development Guidelines

When working on AI agent code (especially in the telegram-bot package), follow these principles:

### Telegram Bot Dev Philosophy: Simplicity First

- **Agents are just "for loops with LLM calls"** - avoid over-engineering
- Prefer minimal recursive loops over complex state machines
- Trust the LLM to orchestrate its own workflow rather than imposing rigid patterns
- NO: Graph-based workflows, state machines, rigid node systems
- YES: Simple loops, direct tool calls, minimal state
- Fetch MCP tool definitions dynamically from server
- Pass tool descriptions directly to LLM in system prompt
- Let the LLM select tools based on descriptions, not complex routing
- Keep state minimal: current input, history, context
- Store conversation history in simple data structures (Map, Array)
- Avoid complex state objects with 20+ fields
- Use simple try-catch blocks
- Let the LLM interpret and learn from errors
- Provide environmental feedback, not pre-programmed error flows

### What to Avoid

- ❌ LangGraph or similar workflow frameworks
- ❌ Pre-defined workflow patterns (Intent → Plan → Execute → Reflect)
- ❌ Complex approval/routing nodes
- ❌ Over-engineered state management
- ❌ Hardcoded tool mappings or action registries

### What to Embrace

- ✅ Direct LLM API calls with minimal abstraction
- ✅ Dynamic tool discovery from MCP servers
- ✅ Environmental feedback loops
- ✅ Trust in LLM's ability to self-organize
- ✅ Code that reads like a simple script, not a framework

## Testing Guidelines

- When asked to fix tests, never touch the actual implementation.
- When asked to fix a bug, never touch the tests that surfaced the bug.
- **Embrace test driven development**

## Environment Variables

### CouchDB Configuration

```bash
# Required
COUCHDB_HOST=localhost
COUCHDB_PORT=5984
COUCHDB_PROTOCOL=http

# Authentication (choose one method)
# Method 1: Username/Password
COUCHDB_USERNAME=your-username
COUCHDB_PASSWORD=your-password

# Method 2: Admin credentials
COUCHDB_ADMIN_USERNAME=admin
COUCHDB_ADMIN_PASSWORD=admin-password
```

### AI Model Configuration

- `LLM_MODEL`: Set to configure AI model (e.g., `claude-sonnet-4-0`, `claude-opus-4-0`, `claude-3-5-haiku-20241022`)
- MCP server runs on port 3002 by default (via proxy)

### Additional Environment Variables

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
BOT_PERSONA_ID=gtd_coach  # Options: butler, gtd_coach, zen_master

# Application
VITE_COUCHDB_API_KEY=your-api-key

# Development
NODE_ENV=development|production
```
