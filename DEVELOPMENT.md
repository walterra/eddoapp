# Development Guide

This guide provides detailed technical information for developing Eddo, a GTD-inspired todo and time tracking application built as a monorepo.

## Architecture Overview

### Monorepo Structure

- **`packages/web-client`**: React/TypeScript frontend with PouchDB for offline-first storage
- **`packages/web-api`**: Hono API server for authentication and CouchDB proxy
- **`packages/mcp_server`**: MCP (Model Context Protocol) server for external integrations
- **`packages/core`**: Shared types, utilities, and data models across packages
- **`packages/telegram_bot`**: Telegram bot with AI agent capabilities using Anthropic Claude

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

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Getting Started](docs/01_getting-started.md) - Prerequisites and setup instructions
- [Project Structure](docs/02_project-structure.md) - Overview of the codebase organization
- [Architecture](docs/03_architecture.md) - Details of the application architecture and design
- [Development Workflow](docs/04_development-workflow.md) - Guidelines for making changes, testing, and code style
- [Deployment](docs/05_deployment.md) - Building and deploying the application

## Quick Start

### Prerequisites

- Node.js ≥18.11.0
- pnpm ≥7.1.0
- Docker (required for integration and e2e tests - testcontainers auto-manages CouchDB)

### Installation

```bash
git clone <repository-url>
cd eddoapp
pnpm install
```

### Development Commands

```bash
# Start both web client and API server
pnpm dev

# Or start components individually
pnpm dev:web-client    # React frontend (port 5173, dev only)
pnpm dev:web-api       # API server (port 3000, main entry point)
pnpm dev:server        # MCP server (port 3002)
pnpm dev:telegram-bot  # Telegram bot
```

**Development Access:**

- **Main Application**: http://localhost:3000/ (API server proxies to web client)
- **Web Client Dev Server**: http://localhost:5173/ (Vite dev server, used internally)
- **MCP Server**: http://localhost:3002/ (Model Context Protocol server)

### Build Commands

```bash
pnpm build              # Build all packages
pnpm build:client       # Build client only
pnpm build:server       # Build MCP server only
pnpm build:shared       # Build core package only
pnpm build:telegram-bot # Build telegram bot only
```

### Testing Commands

**Note**: Integration and e2e tests automatically start/stop CouchDB containers using testcontainers. Docker must be running, but no manual CouchDB setup is needed.

```bash
pnpm test              # Run unit tests
pnpm test:unit         # Run unit tests explicitly
pnpm test:integration  # Run integration tests (auto-starts CouchDB container)
pnpm test:e2e          # Run end-to-end tests (auto-starts CouchDB container)
pnpm test:all          # Run full test suite with linting
pnpm test:ci           # CI test suite
```

### Quality Commands

```bash
pnpm lint              # ESLint check
pnpm lint:format       # Prettier format check
pnpm format            # Prettier formatting
pnpm tsc:check         # TypeScript type checking
pnpm knip              # Check unused dependencies
```

## Data Model

Current data model (Alpha3):

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

## Configuration

### AI Model Configuration

Configure AI models via the `LLM_MODEL` environment variable:

**Claude 4 Models (May 2025):**

- `claude-opus-4-20250514` or `claude-opus-4-0` (most capable)
- `claude-sonnet-4-20250514` or `claude-sonnet-4-0` (balanced performance)

**Claude 3.7 Models:**

- `claude-3-7-sonnet-20250219`

**Claude 3.5 Models:**

- `claude-3-5-haiku-20241022` (fastest)

### Telegram Bot Configuration

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
ANTHROPIC_API_KEY=your-claude-api-key
```

### CouchDB Configuration (for Backup/Restore)

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

## Telegram Bot

The Telegram bot provides AI-powered todo management through natural language:

```bash
# Start the bot
pnpm dev:telegram-bot
```

Features:

- Natural language todo creation and management
- Claude AI integration for intelligent responses
- MCP client for accessing todo data
- Simple agent loop architecture

## MCP Server Testing

The MCP (Model Context Protocol) server provides programmatic access to the todo system.

### Testing the MCP Server

```bash
# Prerequisites: Start the MCP server
pnpm dev:server  # Server runs on port 3002

# Test all server information
pnpm test:mcp

# Test specific sections
pnpm test:mcp tagstats    # Top used tags across all todos
pnpm test:mcp overview    # Server overview and basic info
pnpm test:mcp datamodel   # TodoAlpha3 schema documentation
pnpm test:mcp tools       # Available MCP tools
pnpm test:mcp examples    # Usage examples
```

### MCP Server Features

- **Structured JSON responses**: All responses include execution metrics, error handling, and recovery suggestions
- **API key authentication**: Per-user database isolation using X-API-Key headers
- **Error handling**: Error recovery with actionable suggestions
- **Performance metrics**: Execution time tracking and performance insights
- **Auto-database creation**: Automatic database creation when needed

## Backup & Restore

### Interactive Backup & Restore

```bash
pnpm backup:interactive   # Create backups with interactive CLI
pnpm restore:interactive  # Restore databases with interactive CLI
```

### Command Line Backup & Restore

```bash
# Direct backup with arguments
pnpm backup -- --database todos-dev --output ./backups/

# Direct restore with arguments
pnpm restore -- --input ./backups/backup-file.json --database todos-dev

# Verify backup integrity
pnpm backup:verify
```

### Backup Features

- **Automatic database discovery**: Lists all available databases
- **Progress tracking**: Real-time progress indicators with file size and duration
- **Timestamped filenames**: Automatic backup file naming with ISO timestamps
- **Verification**: Built-in backup integrity checking
- **Parallel processing**: Configurable parallelism for faster backups
- **Error handling**: Error recovery and user-friendly messages
- **Force restore**: Option to recreate databases before restore for clean state

## Additional Tools

### CLI Interface

```bash
pnpm cli              # Interactive CLI
pnpm cli:test         # Test CLI functionality
```

### Mock Data

```bash
pnpm populate-mock-data         # Add sample data
pnpm populate-mock-data:dry-run # Preview without changes
```

### Single Test Execution

```bash
pnpm vitest:run src/path/to/file.test.ts  # Run specific test file
```

## CI/CD Features

- **Pre-commit hooks**: Automatic TypeScript checking, linting, and formatting via Husky
- **GitHub Actions**: Automated testing with testcontainers (auto-managed CouchDB)
- **Database isolation**: Per-user database isolation with API key authentication for MCP server
- **Test optimization**: Separate unit/integration/e2e test commands for faster feedback

## Contributing

When contributing to this repository, please ensure you follow the coding standards and development workflow documented in [Development Workflow](docs/04_development-workflow.md).
