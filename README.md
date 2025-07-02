# Eddo

_Loosely GTD inspired todo & time tracking app_

Consider this an alpha state proof of concept for now. I encourage you to give it a try and I'd love to hear your feedback, but don't expect 100% data integrity across updates.

The current version persists its data just locally within the browser via PouchDb.

The app is inspired by my offline/notebook based approach I've been using for 10+ years.

Notebook             |  Eddo
:-------------------------:|:-------------------------:
<img src="./img/notebook.jpg" alt="notebook" width="60%" /> | <img src="./img/screenshot.png" alt="Eddo screenshot" width="100%" />

- The form to add a todo consists of a context (e.g. home/work), the todo itself and a due date.
- The whole view is filtered by calendar week and you page through weeks.
- Each column can be treated similar to a GTD-like context.
- Within a column, todos will be grouped by date.
- Each todo has a start/pause button for time tracking.
- Time tracked for todos will be summed up for each day and column.

## Setup

- Clone the repository
- Run `pnpm install` (or `npm install` if you don't use `pnpm`).
- Run `pnpm dev` to give it a try as is on your local machine.
- Run `pnpm build` to create a production build which you can deploy/use to your liking.

## Configuration

### AI Model Configuration

The application supports configurable AI models via the `LLM_MODEL` environment variable. Current available models:

**Claude 4 Models (May 2025):**
- `claude-opus-4-20250514` or `claude-opus-4-0` (most capable)
- `claude-sonnet-4-20250514` or `claude-sonnet-4-0` (balanced performance)

**Claude 3.7 Models:**
- `claude-3-7-sonnet-20250219`

**Claude 3.5 Models:**
- `claude-3-5-haiku-20241022` (fastest)

## MCP Server Testing

The application includes an MCP (Model Context Protocol) server that provides programmatic access to the todo system. You can test the server's functionality using the included test script.

### Testing the MCP Server

**Prerequisites:**
- Start the MCP server: `pnpm dev:server`
- The server runs on port 3002 by default

**Test all server information (including tag statistics):**
```bash
pnpm test:mcp
```

**Test specific sections:**
```bash
pnpm test:mcp tagstats    # Top used tags across all todos
pnpm test:mcp overview    # Server overview and basic info
pnpm test:mcp datamodel   # TodoAlpha3 schema documentation
pnpm test:mcp tools       # Available MCP tools
pnpm test:mcp examples    # Usage examples
```

The test script handles MCP session initialization and provides formatted output of the server's capabilities and statistics.

### MCP Server Features

The MCP server provides:

- **Structured JSON responses**: All responses include execution metrics, error handling, and recovery suggestions
- **API key authentication**: Per-user database isolation using X-API-Key headers
- **Error handling**: Error recovery with actionable suggestions
- **Performance metrics**: Execution time tracking and performance insights
- **Auto-database creation**: Automatic database creation when needed

## Backup & Restore

The application includes backup and restore functionality for CouchDB databases, supporting both interactive and command-line usage.

### Prerequisites

- CouchDB server running and accessible
- Environment variables configured (see Configuration section below)

### Interactive Backup

Create backups using an interactive CLI interface:

```bash
pnpm backup:interactive
```

The interactive backup tool will:
- Discover available databases automatically
- Allow you to select which database to backup
- Show progress indicators and statistics
- Save backups to the `backups/` directory with timestamped filenames

### Interactive Restore

Restore databases using an interactive CLI interface:

```bash
pnpm restore:interactive
```

The interactive restore tool will:
- Show available backup files with metadata
- Allow you to select which backup to restore
- Create the target database if it doesn't exist
- Provide progress indicators and confirmation prompts

### Command Line Backup & Restore

**Direct backup with arguments:**
```bash
pnpm backup -- --database todos-dev --output ./backups/
```

**Direct restore with arguments:**
```bash
pnpm restore -- --input ./backups/backup-file.json --database todos-dev
```

### Backup Verification

Verify the integrity of backup files:

```bash
pnpm backup:verify
```

### Configuration

Set the following environment variables for CouchDB access:

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

### Backup Features

- **Automatic database discovery**: Lists all available databases
- **Progress tracking**: Real-time progress indicators with file size and duration
- **Timestamped filenames**: Automatic backup file naming with ISO timestamps
- **Verification**: Built-in backup integrity checking
- **Parallel processing**: Configurable parallelism for faster backups
- **Error handling**: Error recovery and user-friendly messages
- **Force restore**: Option to recreate databases before restore for clean state

