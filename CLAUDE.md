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
- MCP server integration tests: `pnpm test:integration:mcp-server` (uses vitest with global setup)
- Agent loop integration tests: `pnpm test:integration:agent-loop` (uses VCR caching, see below)
- Agent loop tests (record): `pnpm test:integration:agent-loop:record` (re-record cassettes)
- Agent loop tests (playback): `pnpm test:integration:agent-loop:playback` (CI mode, no API calls)
- E2E tests: `pnpm test:e2e`
- Full test suite: `pnpm test:all`
- CI test suite: `pnpm test:ci` (excludes telegram-bot integration tests)
- CI test suite with all tests: `pnpm test:ci:all` (requires ANTHROPIC_API_KEY)
- Run single test: `pnpm vitest:run src/path/to/file.test.ts`
- TypeScript check: `pnpm tsc:check`
- MCP server test: `pnpm test:mcp-server` (this lets you run commands against mcp-server)
- Check unused dependencies: `pnpm knip`

### Package-Specific

- Build specific package: `pnpm build:client|api|core|mcp-server|telegram-bot`

### Backup & Restore

- Interactive backup: `pnpm backup:interactive` (prompts for CouchDB URL)
- Interactive restore: `pnpm restore:interactive` (prompts for CouchDB URL)
- With URL flag: `pnpm backup:interactive -- --url http://admin:password@localhost:5984`
- Verify backup: `pnpm backup:verify`
- Automated backup scheduler: `pnpm backup:auto` (runs continuous backup cycle)
- Retention policy: `pnpm backup:retention` (apply retention policy to cleanup old backups)
- Retention dry-run: `pnpm backup:retention --dry-run` (preview what would be deleted)

**Backup Scheduler Options:**

- `--interval <time>` - Backup interval (e.g., "24h", "1d", "30m") - default: 24h
- `--pattern <glob>` - Database name pattern to backup (e.g., "eddo*\*") - default: eddo*\*
- `--run-once` - Run single backup cycle and exit
- `--no-verify` - Skip backup verification
- `--no-retention` - Skip retention policy

**Environment Variables for Backups:**

- `BACKUP_DIR` - Directory for backup files (default: ./backups)
- `BACKUP_DATABASE_PATTERN` - Glob pattern for databases to backup (default: eddo\_\*)

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

### Testing Architecture

The project uses a layered testing approach with testcontainers for database isolation:

- **Unit Tests**: Vitest for individual functions and components
- **Integration Tests**: Vitest with testcontainers for ephemeral CouchDB instances
- **E2E Tests**: Vitest for end-to-end workflow testing

#### Testcontainers Setup

Integration and E2E tests use `@testcontainers/couchdb` for automated Docker container management:

- **Global Setup**: `test/global-testcontainer-setup.ts` manages CouchDB container lifecycle
- **Complete Isolation**: Each test suite gets an ephemeral CouchDB container
- **No Manual Setup**: Tests start/stop containers automatically
- **Works Everywhere**: Identical behavior in local development and CI

#### MCP Server Integration Tests

Runner script: `scripts/run-mcp-server-integration-tests.ts`

1. Starts CouchDB testcontainer
2. Creates test database
3. Starts MCP server with testcontainer URL
4. Runs vitest with `packages/mcp_server/vitest.integration.config.ts`
5. Tears down server and container

**Command**: `pnpm test:integration:mcp-server`

#### Agent Loop Integration Tests

Runner script: `scripts/run-telegram-bot-integration-tests.ts`

Tests the Telegram bot's AI agent loop with VCR-style caching for LLM responses.

**VCR Caching System** (`packages/telegram_bot/src/integration-tests/vcr/`):

- Records LLM API responses to cassette files on first run
- Replays cached responses on subsequent runs (fast, free, deterministic)
- Freezes time during playback to match recording timestamp
- Normalizes dynamic content (user IDs, timestamps, database names) for hash matching

**VCR Modes**:

- `VCR_MODE=auto` (default): Record if cassette missing, replay if exists
- `VCR_MODE=record`: Always record fresh responses (updates cassettes)
- `VCR_MODE=playback`: Only replay, fail if cassette missing (CI mode)
- `VCR_DEBUG=1`: Enable verbose logging for debugging hash mismatches

**Commands**:

- `pnpm test:integration:agent-loop` - Auto mode (hybrid, requires `ANTHROPIC_API_KEY`)
- `pnpm test:integration:agent-loop:record` - Re-record all cassettes (requires `ANTHROPIC_API_KEY`)
- `pnpm test:integration:agent-loop:playback` - Playback only, no API key needed (CI default)

**API Key Requirements**:

- Playback mode: No `ANTHROPIC_API_KEY` required (uses cached responses)
- Auto/Record modes: `ANTHROPIC_API_KEY` required for live API calls

**Limitations**: Multi-step workflows that reference specific todo IDs cannot use cached playback because the LLM response contains hardcoded IDs from the recording session. These tests are skipped in playback mode and run live in auto/record modes.

**Cassette Location**: `packages/telegram_bot/src/integration-tests/cassettes/`

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

### RSS Feed Sync Architecture

**Location**: `packages/web-api/src/rss/`

**Purpose**: Sync RSS/Atom feed items into Eddo todos with autodiscovery and deduplication

**Components**:

- **Autodiscovery** (`autodiscovery.ts`): Feed URL discovery from HTML pages
  - Parses `<link rel="alternate" type="application/rss+xml">` tags
  - Supports RSS, Atom, RDF, and JSON Feed formats
  - Users can add website URLs instead of finding feed URLs manually
- **RssClient** (`client.ts`): Feed fetching and parsing using `feedsmith` library
  - Fetches and parses RSS/Atom/RDF/JSON feeds
  - Maps feed items to TodoAlpha3 structure
  - Generates external IDs: `rss:<sha256(feed-url)>/<sha256(item-guid)>`
  - Strips HTML and truncates descriptions
- **RssSyncScheduler** (`sync-scheduler.ts`): Periodic sync service
  - Runs in web-api process
  - Checks every 5 minutes for users needing sync
  - Per-user sync intervals (default 60 minutes)
  - Deduplication via `externalId` field
  - Creates new todos only (RSS items are immutable)
- **User Configuration**: Stored in UserPreferences (user_registry_alpha2)
  - `rssSync`: boolean - enable/disable
  - `rssFeeds`: RssFeedConfig[] - array of subscribed feeds
  - `rssSyncInterval`: number - minutes between syncs (default 60)
  - `rssSyncTags`: string[] - tags to add (default: `["gtd:someday", "source:rss"]`)
  - `rssLastSync`: string - ISO timestamp of last sync

**RssFeedConfig Structure**:

```typescript
interface RssFeedConfig {
  url: string; // Original URL provided by user
  feedUrl: string; // Discovered/resolved feed URL
  title?: string; // Feed title
  enabled: boolean; // Whether sync is enabled for this feed
  addedAt: string; // ISO timestamp when added
}
```

**Telegram Bot Commands**:

- `/rss` - Show help and current status
- `/rss on` - Enable automatic sync
- `/rss off` - Disable sync
- `/rss add <url>` - Add a feed (autodiscovery supported)
- `/rss list` - List subscribed feeds
- `/rss remove <number>` - Remove feed by number
- `/rss status` - View current configuration

**Fixed Values**:

- Context: `read-later`
- Tags: `gtd:someday`, `source:rss`
- Completion: Manual only (RSS items never auto-complete)

**Data Flow**:

1. User adds feed via `/rss add <url>`
2. Autodiscovery fetches URL and finds RSS/Atom feed links
3. Feed URL and title saved to user preferences
4. User enables sync with `/rss on`
5. Scheduler checks user preferences every 5 minutes
6. If sync interval elapsed, fetches all enabled feeds
7. For each feed item, generates externalId and checks for duplicates
8. Creates new todos for new items (skips existing)
9. Updates `rssLastSync` timestamp

**Library**: `feedsmith` (npm) - chosen over `rss-parser`:

- Actively maintained (2025)
- Full TypeScript support
- Supports RSS, Atom, RDF, JSON Feed, and OPML
- Forgiving parser for malformed real-world feeds
- Fastest among JavaScript feed parsers

## Documentation Maintenance

Keep `README.md` up to date when making changes. The README is end-user focused (installation, usage, configuration) while CLAUDE.md is agent-focused (debugging, restrictions, architecture).

## UI/UX Design Principles

Full documentation: `spec/design-principles.md`

**Core Philosophy:**

- Quality is the strategy, not a tradeoff against speed
- Design for power users first — don't dumb down for imaginary beginners
- Every element must earn its place — decoration without purpose is noise

**Visual Design:**

- Hierarchy through contrast (font weight, color saturation, spacing) — not borders
- Use design tokens: 5-7 font sizes, spacing scale (4/8/12/16/24/32/48/64), semantic colors
- Typography is 90% of the interface — use Inter, establish clear hierarchy
- Dark mode is expected for productivity tools, not an afterthought
- Whitespace is a feature — let content breathe

**Interaction Design:**

- Every interaction deserves feedback (hover, focus, active states)
- Motion with intention: guide attention, provide continuity, 200-300ms max
- Speed is a feature — optimistic updates, skeleton loaders, no layout shifts
- Keyboard-first: command palette (Cmd+K), shortcuts for common actions

**Quality Test (before shipping):**

1. Does this earn its place?
2. Does this feel fast?
3. Is there feedback?
4. Is this consistent?
5. Would best-in-class products ship this?

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
- ESLint complexity guards as errors (max-lines:300, max-lines-per-function:50, complexity:10, max-depth:3, max-params:4, max-nested-callbacks:4, max-statements:30)
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

### Handling ESLint Complexity Errors

When ESLint reports complexity guard violations (`max-lines`, `max-lines-per-function`, `complexity`, etc.), **do NOT use shortcuts**:

**❌ NEVER do this:**

- Condense multiple statements onto single lines
- Remove JSDoc comments or documentation
- Remove log statements to reduce line count
- Combine unrelated logic to reduce function count
- Use terse variable names to save space

**✅ ALWAYS do proper refactoring:**

1. **For `max-lines` (file too long, max 300):**
   - Identify cohesive groups of functionality (e.g., health checks, metrics, validation)
   - Extract to new module with clear single responsibility
   - Use proper imports/exports to maintain encapsulation
   - Example: Extract `ConnectionHealthManager` from `MCPConnectionManager`

2. **For `max-lines-per-function` (function too long, max 50):**
   - Identify logical sub-steps within the function
   - Extract helper functions with descriptive names
   - Each helper should do one thing well
   - Keep the original function as an orchestrator

3. **For `complexity` (too many branches, max 10):**
   - Use early returns to reduce nesting
   - Extract conditional logic to well-named predicates
   - Consider strategy pattern for multiple similar branches
   - Use lookup objects instead of switch/if chains

4. **For `max-depth` (too deeply nested, max 3):**
   - Extract inner logic to separate functions
   - Use guard clauses (early returns)
   - Consider inverting conditions

**Refactoring checklist:**

- [ ] New modules have clear, single responsibilities
- [ ] All existing functionality is preserved
- [ ] All existing tests still pass
- [ ] New code has appropriate test coverage
- [ ] JSDoc comments are preserved or updated
- [ ] Log statements are preserved at appropriate levels

## Git Rules

- **CRITICAL: Questions are not instructions** - When user asks a question (e.g., "is this correct?", "should we do X?"), answer the question and STOP. Do not make changes or commit until explicitly instructed.
- **CRITICAL: Never commit after answering a question** - Wait for explicit approval like "yes, do it" or "go ahead" before any git operations.
- Use CC (Conventional Commit) prefixes for commit messages
- Do not add "Generated with" or "Co-authored" sections to commit messages
- Never git add all files. just add the files related to your current work/tasks.
- **NEVER use `git filter-branch` on the entire repository history** - this rewrites all commits and is extremely destructive
- For removing files from history, prefer simpler solutions:
  - Just delete the files and commit the change
  - Use `git rebase -i` to edit specific recent commits
  - If history rewriting is absolutely necessary, use modern tools like `git filter-repo` with careful consideration
- Always warn about and get explicit confirmation before any operation that rewrites git history
- Never push directly to `main` branch
- Always verify current branch before pushing: `git branch --show-current`
- Always ask for user confirmation before pushing
- Use `git remote -v` to identify correct repo for GitHub CLI commands

## CHANGELOG & Release Workflow

This project uses **Changesets** for automated CHANGELOG generation and version management, with **Commitizen** and **Commitlint** for enforcing conventional commits. Do not run changesets or commits by yourself, do them only when user explictly asks for it.

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

### OpenTelemetry Configuration

```bash
# Disable OTEL export (logs still go to console/file)
OTEL_SDK_DISABLED=true

# Service identification (auto-set per service)
OTEL_SERVICE_NAME=eddo-telegram-bot

# Resource attributes for APM filtering
OTEL_RESOURCE_ATTRIBUTES=service.version=0.3.0,deployment.environment=development

# OTLP endpoint (default: http://localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### EDOT Collector Configuration

Required for `pnpm otel:collector:start`:

```bash
# Elasticsearch API key (generate in Kibana -> Stack Management -> API Keys)
ELASTIC_API_KEY=your_api_key_here

# Elasticsearch endpoint (use Docker networking for collector)
COLLECTOR_ES_NODE=https://host.docker.internal:9200

# TLS for self-signed certs (optional)
OTEL_TLS_VERIFY=false
```

## Observability (O11y)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Services                            │
│         (telegram-bot, web-api, mcp-server)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │      EDOT Node.js       │    │   Pino Logger + OTel    │    │
│  │  (@elastic/otel-node)   │    │      Transport          │    │
│  │  • Auto-instrumentation │    │  • Structured logs      │    │
│  │  • Traces & Metrics     │    │  • Trace correlation    │    │
│  └───────────┬─────────────┘    └───────────┬─────────────┘    │
│              └──────────────┬───────────────┘                   │
└─────────────────────────────┼───────────────────────────────────┘
                              ▼
               ┌──────────────────────────────┐
               │       EDOT Collector         │
               │    (localhost:4317/4318)     │
               │  • OTLP receiver (gRPC/HTTP) │
               │  • elasticapm processor      │
               │  • spanmetrics connector     │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │       Elasticsearch          │
               │  • traces-apm.otel-*         │
               │  • metrics-apm.otel-*        │
               │  • logs-apm.otel-*           │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │          Kibana APM          │
               │  • Services, Traces, Metrics │
               └──────────────────────────────┘
```

### Commands

```bash
# Collector management
pnpm otel:collector:start    # Start EDOT Collector (Docker)
pnpm otel:collector:stop     # Stop collector
pnpm otel:collector:logs     # View collector logs
pnpm otel:collector:status   # Check collector status

# Run without telemetry export
OTEL_SDK_DISABLED=true pnpm dev:telegram-bot
```

### Instrumented Operations (telegram-bot)

| Span Name                 | Description                 | Attributes                                     |
| ------------------------- | --------------------------- | ---------------------------------------------- |
| `agent_execute`           | Full agent workflow         | user.id, message.length, agent.tool_calls      |
| `agent_iteration`         | Single agent loop iteration | agent.iteration, mcp.tool                      |
| `llm_generate`            | Claude API call             | llm.model, llm.input_tokens, llm.output_tokens |
| `mcp_tool_execute`        | MCP tool invocation         | mcp.tool, mcp.operation                        |
| `telegram_message_handle` | Incoming message processing | telegram.chat.id, user.id                      |
| `scheduler_send_briefing` | Daily briefing delivery     | user.id, username, telegram.chat.id            |

### Packages

- `@eddo/core-instrumentation`: Shared Pino logger factory, withSpan() helper, SpanAttributes
- Configuration: `otel-collector-config.yml`, `docker-compose.otel.yml`
