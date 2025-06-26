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

