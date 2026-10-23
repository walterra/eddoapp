# Eddo

_GTD-inspired todo & time tracking with AI integration_

<p align="center">
  <img src="https://eddoapp.com/img/eddo-table.webp" alt="Eddo todo table with subtasks, GTD tags, due dates, and time tracking" width="54.5%" />
  <img src="https://eddoapp.com/img/eddo-graph.webp" alt="Eddo graph visualization of todos, agents, and relationships" width="41%" />
</p>

📺 [Sneak peek](https://www.youtube.com/watch?v=jiWS9pP_cX0) · [Setup walkthrough & Pi demo](https://www.youtube.com/watch?v=jQH693-T5NQ)

> **Alpha software:** This solo side project is under active development. Expect rough edges and breaking changes. Back up your data; data integrity across updates is not guaranteed.

## Overview

Eddo combines GTD (Getting Things Done) with AI-assisted task management. It grew from a notebook-based workflow refined over 10+ years.

Manage todos through the web app, a Telegram assistant, or the Model Context Protocol (MCP). AI integrations are optional.

## Features

- **GTD organization** — Group tasks by context and use tags for next actions, waiting items, and someday lists.
- **Calendar week view** — Review tasks and due dates by week.
- **Task relationships** — Explore subtasks and blocking dependencies in a graph.
- **Time tracking** — Start and pause timers, review summaries, and filter active tasks.
- **Offline-first web app** — Work with local storage and sync changes through CouchDB.
- **Telegram assistant** — Manage tasks in natural language with a configurable AI provider and model.
- **Scheduled reports** — Receive daily briefings and recaps in your timezone.
- **External sources** — Import GitHub issues, RSS items, and emails into todos.
- **MCP and Pi integration** — Connect AI tools and coding assistants to your tasks.

## Quick Start

**Requirements:** Node.js ≥24, pnpm ≥11.5.3, Git, and Docker with the daemon running. The repository pins pnpm 12.14.0.

```bash
git clone https://github.com/walterra/eddoapp.git
cd eddoapp
pnpm install
pnpm dev:setup
pnpm dev
```

Open **http://localhost:3000** and choose **Create account**, or sign in with an existing account.

The setup wizard checks prerequisites, starts CouchDB and Elasticsearch, generates `.env`, and builds required packages. It can also create an MCP/agent user and link bundled Pi skills when Pi is installed.

`pnpm dev` starts the web client, API, and MCP server. The Telegram bot runs separately.

Setup problems? Run `pnpm dev:doctor` to check configuration, services, ports, and prerequisites.

## Integrations

### Telegram Bot

Create a bot through Telegram's BotFather and configure `.env`:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
ANTHROPIC_API_KEY=your-provider-key
LLM_MODEL=claude-sonnet-4-5-20250929
```

For another provider, configure its credentials and a registered model, for example `LLM_MODEL=openai/gpt-5.2` with `OPENAI_API_KEY`.

```bash
pnpm dev:telegram-bot
```

Message the bot privately and follow its account-linking instructions. Group messages receive a private-chat link and are not processed.

Try:

- “Add a work todo for tomorrow's meeting.”
- “What's overdue?”
- “Start tracking time on the API refactor.”

Use `/help` for commands and `/new` to start a fresh assistant conversation.

**Daily reports:** Configure schedules and timezone in your profile. Briefings highlight actionable tasks, overdue work, and appointments; recaps summarize completions and next actions. Reports use current task data and conversation context. Large lists are summarized rather than shown in full.

**History and recovery:** Conversations and pending work survive restarts through Pi Durable. Older conversation history remains available to the assistant. Replies support Markdown formatting; scheduled briefings suppress link previews.

**Important limits:**

- Run exactly **one bot process** against the same runtime databases.
- Do not repeat a request while its outcome is unconfirmed. Check task state before retrying an interrupted change.
- Pending replies retry within delivery limits; ambiguous sends can produce duplicate chunks.
- Back up runtime journals and mutation receipts alongside application data. Chat history alone cannot restore pending work.

Restart the bot after changing model settings. Optional controls include `LLM_MAX_TOKENS` (default `4096`) and `LLM_REASONING_EFFORT` (default `low` for supported models).

See [Telegram operations](spec/durable_telegram_operations.md) for configuration limits, deployment, recovery, and runtime details.

### GitHub Issue Sync

Import issues assigned to you:

1. Create a [personal access token](https://github.com/settings/tokens) with `repo` or `public_repo` scope.
2. Send `/github token ghp_your_token` in your private bot chat.
3. Enable sync with `/github on`; check it with `/github status`.

Each repository becomes its own context. Imported issues complete automatically when closed on GitHub.

### RSS Feed Sync

1. Add a feed: `/rss add https://example.com/feed.xml`
2. Enable sync: `/rss on`
3. List feeds: `/rss list`

RSS/Atom autodiscovery lets you supply a website URL instead of finding its feed URL.

### Email Sync (Gmail)

1. Start authorization: `/email auth`
2. Authorize access in your browser.
3. Enable sync: `/email on`
4. Select the source folder: `/email folder Eddo`

Requires Google Cloud OAuth configuration. See [Gmail setup](docs/gmail-oauth-setup.md).

### MCP Server

Connect MCP-compatible tools to manage tasks programmatically. `pnpm dev` starts the server; run it separately with `pnpm dev:mcp-server` when needed.

Requests require an API key through `Authorization: Bearer <key>` or `X-API-Key`. Generate a key in **User Profile → Security** or use the MCP/agent credentials created during setup.

Do not expose the MCP server to untrusted networks. See the [development guide](DEVELOPMENT.md#mcp-server-testing) for testing.

### Pi Coding Agent

Eddo includes task-management skills, ES|QL and search skills, and chart extensions for [Pi](https://buildwithpi.ai). The setup wizard links bundled integrations when Pi is already installed.

Browse the [bundled skills](packages/chat-agent/skills) and [extensions](packages/chat-agent/extensions) for the shipped inventory.

## Backup & Recovery

Run commands from the repository root:

```bash
pnpm backup:interactive
pnpm backup:verify backups/<database>-<timestamp>.json
pnpm restore:interactive

# Continuous application backups; default database pattern: eddo_*
pnpm backup:auto
```

Keep each archive and its `.json.metadata.json` sidecar together. Store encrypted copies off-host and verify backups before restoring.

Default-prefix application backups include runtime journals and mutation receipts. Check database selection when using custom prefixes. These backups are not atomic snapshots across databases and exclude unsynced browser data and server configuration.

Stop relevant writers before restoring. Restoring older execution state can repeat effects that occurred after the backup.

See the [disaster recovery guide](docs/07_disaster-recovery.md) for full-server backups, retention, archive formats, and restore procedures.

## Documentation

- [Development guide](DEVELOPMENT.md) — Package structure, commands, testing, and contribution workflow.
- [Architecture](docs/03_architecture.md) — Storage and application design.
- [Deployment](docs/05_deployment.md) — Deployment guidance.
- [Telegram operations](spec/durable_telegram_operations.md) — Single-owner deployment and durable recovery.
- [Disaster recovery](docs/07_disaster-recovery.md) — Backup and restore procedures.
- [Benchmarks](scripts/benchmarks/README.md) — Isolated synthetic workloads and performance reports.

## Development

Run commands from the repository root:

```bash
pnpm dev           # Web client, API, and MCP server
pnpm test          # Unit tests
pnpm build         # Build all packages
pnpm check:commit  # TypeScript, ESLint, and formatting checks
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed commands and [the development workflow](docs/04_development-workflow.md) for contribution guidelines.

## License

MIT
