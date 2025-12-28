# Eddo

_Loosely GTD inspired todo & time tracking app_

A monorepo containing a React frontend, MCP server, and Telegram bot with AI agent capabilities. Built with offline-first architecture using PouchDB for data persistence.

**⚠️ Alpha State**: This is a proof of concept. While we encourage you to try it and provide feedback, don't expect 100% data integrity across updates.

The app is inspired by an offline/notebook based approach that has been refined over 10+ years.

|                          Notebook                           |                                 Eddo                                  |
| :---------------------------------------------------------: | :-------------------------------------------------------------------: |
| <img src="./img/notebook.jpg" alt="notebook" width="60%" /> | <img src="./img/screenshot.png" alt="Eddo screenshot" width="100%" /> |

## Key Features

- **GTD-Style Contexts**: Organize todos by context (e.g., work, home) in Kanban-style columns
- **Calendar Week Navigation**: View and navigate todos by calendar week
- **Time Tracking**: Start/pause timers for individual todos with daily summaries
- **Offline-First**: PouchDB provides local storage with real-time sync capabilities
- **AI Integration**: Telegram bot with Claude AI for natural language todo management
- **GitHub Issue Sync**: Automatic one-way sync of GitHub issues assigned to you to todos with deduplication
- **MCP Server**: Programmatic access via Model Context Protocol
- **Data Migration**: Automatic schema versioning and migration system

## Architecture

A **monorepo** with four main packages:

- **Web Client**: React/TypeScript frontend with offline-first PouchDB storage
- **MCP Server**: Model Context Protocol server for external integrations
- **Core**: Shared types and utilities across packages
- **Telegram Bot**: AI-powered bot using Anthropic Claude

Key patterns: database-centric design, offline-first architecture, and automatic data migration.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (client + MCP server)
pnpm dev

# Start telegram bot
pnpm dev:telegram-bot

# Run tests
pnpm test

# Build for production
pnpm build
```

**Requirements**: Node.js ≥18.11.0, pnpm ≥7.1.0

## Components

### Web Client

React frontend with GTD-style contexts, calendar week navigation, and time tracking. Runs offline-first with PouchDB.

### Telegram Bot

AI-powered bot with **agentic loop architecture** that understands complex, multi-step instructions. Features:

- **Natural language processing**: "Add a work todo for tomorrow's meeting and set a reminder"
- **Autonomous task execution**: Can break down complex requests into multiple actions
- **Dynamic tool selection**: Chooses appropriate MCP tools based on user intent
- **Daily briefings**: Scheduled todo summaries at your preferred time
- **GitHub integration**: Configure GitHub issue sync via bot commands

Set `TELEGRAM_BOT_TOKEN` and `ANTHROPIC_API_KEY` environment variables to get started.

#### GitHub Issue Sync

Automatically sync GitHub issues **assigned to you** to Eddo todos:

1. **Create a GitHub Personal Access Token** at https://github.com/settings/tokens
   - Select scope: `repo` (for private repos) or `public_repo`
2. **Configure via Telegram bot**: `/github token ghp_your_token`
3. **Enable sync**: `/github on`
4. **Check status**: `/github status`

Issues sync periodically (default: hourly) with:

- **Initial sync**: Only open issues (avoids old closed issues)
- **Ongoing syncs**: Issues updated since sync enabled (max lookback prevents syncing ancient history)
- **Context assignment**: Each repository becomes its own context (e.g., `elastic/kibana`, `walterra/d3-milestones`)
- Deduplication via external ID tracking
- Automatic completion when issues are closed
- Update detection for title and description changes
- Customizable tag assignment

### MCP Server

Provides programmatic access to todos via Model Context Protocol. Test with `pnpm test:mcp`.

## Backup & Disaster Recovery

Eddo includes automated backup and restore capabilities:

```bash
# Interactive backup/restore
pnpm backup:interactive
pnpm restore:interactive

# Automated daily backups
pnpm backup:auto --pattern "eddo_user_*"

# Apply retention policy
pnpm backup:retention
```

See [Disaster Recovery Guide](docs/07_disaster-recovery.md) for complete procedures, recovery objectives, and troubleshooting.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup, architecture, testing, and contribution guidelines.
