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
- `packages/core-shared/src/`: Shared code across packages
  - `api/`: Database operations and health monitoring
  - `types/`: TypeScript definitions for shared data models
  - `utils/`: Utility functions with co-located tests
  - `versions/`: Data model versions and migration functions
- `packages/core-server/src/`: Server-side core functionality
  - `api/`: Database factory and server-specific operations
  - `config/`: Server environment configuration and validation
- `packages/core-client/src/`: Client-side core functionality
  - `config/`: Client environment configuration
- `packages/mcp_server/src/`: MCP server implementation
  - `tools/`: MCP tool definitions
  - `server.ts`: FastMCP server setup
- `packages/telegram_bot/src/`: Telegram bot with AI agent
  - `agent/`: Simple agent loop implementation
  - `ai/`: Claude integration and persona management
  - `bot/`: Telegram bot handlers and commands
  - `mcp/`: MCP client integration
- `packages/web-api/src/github/`: GitHub issue sync integration
  - `client.ts`: GitHub API client with Octokit
  - `sync-scheduler.ts`: Periodic sync scheduler
  - `types.ts`: GitHub API type definitions

### GitHub Issue Sync Architecture

**Location**: `packages/web-api/src/github/`

**Purpose**: One-way sync of user's GitHub issues into Eddo todos with deduplication tracking

**Components**:

- **GithubClient**: Factory-based GitHub API client using Octokit
  - Fetches issues via `/user/issues` endpoint
  - Maps GitHub issues to TodoAlpha3 structure
  - Generates consistent external IDs: `github:owner/repo/issues/123`
  - Handles pagination (100 issues per page, max 100 pages)
  - Error handling for 401/403/404 and rate limits (5000 req/hr)
- **GithubSyncScheduler**: Periodic sync service following DailyBriefingScheduler pattern
  - Runs in web-api process (not telegram-bot for reliability)
  - Checks every 5 minutes for users needing sync
  - Per-user sync intervals (default 60 minutes, configurable)
  - Deduplication via `externalId` field in TodoAlpha3
  - Updates existing todos when GitHub issues change
  - Marks todos completed when GitHub issues close
- **User Configuration**: Stored in UserPreferences (user_registry_alpha2)
  - `githubSync`: boolean - enable/disable
  - `githubToken`: string - PAT with `repo` or `public_repo` scope
  - `githubSyncInterval`: number - minutes between syncs
  - `githubSyncTags`: string[] - tags to add to synced todos
  - `githubLastSync`: string - ISO timestamp of last sync
  - `githubSyncStartedAt`: string - ISO timestamp when sync enabled (max lookback)
  - Context: Automatically set from repository full_name (e.g., "elastic/kibana", "walterra/d3-milestones")

**Telegram Bot Commands**:

- `/github` - Show help and current status
- `/github on` - Enable automatic sync
- `/github off` - Disable sync
- `/github token <pat>` - Set GitHub Personal Access Token (auto-deletes message for security)
- `/github status` - View current configuration

**Note:** Manual sync trigger removed - sync runs automatically via scheduler based on user's interval setting

**Security**:

- Token validation (checks `ghp_` or `github_pat_` prefix)
- Token masking in logs (shows first 7 + last 4 chars)
- Auto-delete bot messages containing tokens
- Rate limit handling with helpful error messages

**Rate Limit Handling**:

Comprehensive GitHub API rate limit management to prevent errors and provide better UX:

- **Rate Limit Manager** (`rate-limit-manager.ts`): Factory-based request manager
  - Automatic retry with exponential backoff (1s, 2s, 4s delays, max 3 retries)
  - Request throttling (min 100ms between API calls)
  - Proactive monitoring (warns when <20% requests remain)
  - Request queueing for sequential processing
- **Rate Limit Utilities** (`rate-limit.ts`): Helper functions
  - Extract rate limit headers (x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset)
  - Format reset time as human-readable strings ("in 5 minutes", "at 3:45 PM", "tomorrow at 2:30 AM")
  - Type guard for rate limit errors
  - Warning threshold checks
- **Error Messages**: Enhanced with reset time information
  - Example: "GitHub API rate limit exceeded. Please try again at 3:45 PM."
  - Returned directly in API responses (no persistence)
  - HTTP 429 status code with structured error data
- **UI Integration**: User profile displays rate limit errors
  - Errors shown immediately from API responses
  - Manual resync button displays structured error messages with reset time
  - No persistence needed - fresh error on each attempt
- **GitHub API Limits**:
  - Search API: 30 requests/minute (authenticated)
  - REST API: 5,000 requests/hour (authenticated)
  - Headers tracked: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-ratelimit-used

**Data Flow**:

1. User sets GitHub PAT via Telegram bot
2. User enables sync → sets `githubSyncStartedAt` timestamp (max lookback)
3. Scheduler checks user preferences every 5 minutes
4. If sync interval elapsed, fetches issues from GitHub API:
   - **Initial sync** (no `githubLastSync`): Fetches only **open** issues
   - **Subsequent syncs**: Fetches **all** issues updated since `githubSyncStartedAt`
5. Queries existing todos by `externalId` to detect duplicates
6. Creates new todos or updates existing ones
7. Marks todos completed when GitHub issues close
8. Updates `githubLastSync` timestamp

**Testing**: Mock GitHub API responses, verify deduplication, update detection, error handling

## Documentation Maintenance

Keep `README.md` up to date when making changes. The README is end-user focused (installation, usage, configuration) while CLAUDE.md is agent-focused (debugging, restrictions, architecture).

## Technical Writing Style

Technical writer for documentation and JSDoc comments, direct factual statements only, no filler words (very/really/quite/just/simply/basically/actually/literally/comprehensive), no hedging (probably/maybe/might/could/should), no obvious phrases (please note/it's important to/keep in mind), start with present tense verbs (fetches/calculates/returns), state what not how, one line when possible, omit self-evident type information, active voice only, remove redundant phrases (in order to→to, completely finished→finished), every adjective must add information, sentences under 20 words, if removing a word preserves meaning remove it, strip all decoration keep only information.

## Coding style

### Required Standards

- **CRITICAL**: Prefer functional style with factories instead of object-oriented style, no classes
- **CRITICAL**: Avoid inline types, create interfaces and type definitions instead
- Production-grade TypeScript with strict type safety, zero implicit any
- Use minimal/lightweight TypeScript-style JSDoc to document code with @param and @return tags
- Functional programming patterns with immutable data structures
- Custom error classes extending Error for domain-specific errors
- Dependency injection for testability
- Single responsibility principle with functions under 50 lines and files under 300 lines
- async/await with proper error handling
- Exhaustive union type checking with never fallbacks
- Unit tests with 70% branch coverage using arrange-act-assert pattern
- Tests use describe/it pattern with Vitest
- Place test files alongside implementation with .test.ts/.test.tsx extension
- ESLint strict ruleset with no-explicit-any rule enabled
- ESLint complexity guards as warnings (max-lines:300, max-lines-per-function:50, complexity:10, max-depth:3, max-params:4, max-nested-callbacks:4, max-statements:30) - set to warn to allow gradual improvement
- Prettier formatting with 2-space indent and 100-char line width
- Single quotes, trailing commas
- Semantic versioning with Changesets following conventional commits
- Configuration validation using Zod schemas with descriptive error messages
- Meaningful variable names following domain language (no abbreviations except widely known acronyms)
- Pure functions with no side effects marked with readonly parameters
- Defensive programming with input validation at boundaries
- SOLID principles adherence
- Feature-based module organization over type-based
- TypeScript configuration: --strict true --target ES2022 --moduleResolution bundler --isolatedModules true
- Use snake_case for filenames
- Use camelCase for variables/functions, PascalCase for components/types
- Use typed imports and exports with TypeScript
- Use explicit return types for functions
- Follow existing import sorting (uses prettier-plugin-organize-imports)
- Use TailwindCSS for styling
- Use Prettier for formatting with existing config
- **Always run the proper scripts for linting and formatting before manually fixing code style issues**

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

## CHANGELOG & Release Workflow

This project uses **Changesets** for automated CHANGELOG generation and version management, with **Commitizen** and **Commitlint** for enforcing conventional commits. Do not run changesets or commits by yourself, do them only when user explictly asks for it. replace "@eddo/\*" in the markdown file with the appropriate packages (one or more).

## Changesets

**Do NOT use `yarn changeset`** - it's interactive. Create files directly:

```markdown
# .changeset/<descriptive-name>.md

---

"eddo-app": patch|minor|major

---

Concise single-line description for CHANGELOG.md (not implementation details)
```

**Guidelines for changeset messages:**

- ✅ **Good**: "Add Jest testing infrastructure with 70% coverage thresholds and automated CI testing"
- ❌ **Bad**: Listing every file changed, configuration option, or implementation detail
- Focus on **user-facing value** or **high-level feature addition**
- Keep it **one line** when possible (two max)
- Think: "What would a user want to see in release notes?"

**Pre-commit hooks automatically run**:

- `lint-staged` - formats and lints staged files
- Changes are auto-formatted with Prettier and ESLint

**Commit-msg hook validates**:

- `commitlint` - ensures conventional commit format
- Invalid commits are rejected with helpful error messages

### Versioning Strategy

**Synced versioning** - all packages share the same version number:

- ✅ All packages move together (0.1.0 → 0.2.0)
- ✅ One version for the entire application
- ✅ Simpler releases and changelogs
- ❌ Individual package versions don't make sense for this tightly-coupled app

**Important for changesets:**

- Always specify `"eddo-app"` as the package (root package)
- Version bump applies to ALL packages automatically via fixed versioning config
- Don't list individual packages (`@eddo/web-client`, `@eddo/web-api`, etc.)
- Changes to any package should reference `"eddo-app"` in the changeset

### Release Process

1. Merge release PR (created automatically by changesets/action)
2. Workflow automatically:
   - Creates git tag (e.g., `v0.2.0`)
   - Generates aggregated changelog from all packages
   - Creates GitHub release with combined release notes

Test aggregated changelog locally: `pnpm changeset:aggregate`

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

### Telegram Bot Architecture

**Startup Sequence:**

- `bot.start()` is a blocking call that keeps the bot polling indefinitely
- Use `bot.start()` without `await` to run polling in background

**Example Pattern:**

```typescript
// ✅ Correct: Initialize services first
const scheduler = createScheduler();
scheduler.start();

// Then start bot polling (non-blocking)
bot.start(); // Don't await

// ✅ This code will execute
logger.info('Bot is ready!');
```

**MCP Integration:**

- **Prefer using agents over manual MCP tool calls** for complex queries
- Agents handle data parsing, tool selection, and error handling automatically
- Use manual MCP calls only for simple, well-understood operations
- When briefings or complex data aggregation is needed, use agent message requests

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

# Development
NODE_ENV=development|production
```
