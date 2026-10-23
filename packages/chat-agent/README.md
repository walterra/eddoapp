# @eddo/chat-agent

Skills and extensions for the Eddo chat agent running in Docker containers via pi-coding-agent.

## Structure

```
packages/chat-agent/
├── skills/
│   ├── eddo-todo/          # Todo management via MCP
│   │   ├── SKILL.md        # Skill documentation (loaded into agent context)
│   │   ├── eddo-todo.js    # CLI for todo operations
│   │   ├── eddo-worktree.js
│   │   ├── eddo.js         # Alias for the canonical CLI
│   │   ├── mcp_client.js   # Shared SDK v2 client
│   │   └── package.json
│   ├── eddo-work/          # Structured work phases
│   │   └── SKILL.md
│   └── searxng-search/     # Web search via SearXNG
│       ├── SKILL.md
│       ├── search.js       # Search command
│       ├── content.js      # Content extraction
│       └── package.json
└── extensions/
    ├── graphviz-chart.ts   # Graphviz DOT rendering
    └── vega-chart.ts       # Vega-Lite chart rendering
```

## Skills

### eddo-todo

GTD-style todo management via the Eddo MCP server. Provides commands for:

- Creating, updating, and completing todos
- Time tracking
- Notes and work diary
- File attachments
- Parent-child relationships (subtasks)
- Task dependencies (blockedBy)

### eddo-work

Structured implementation workflow with phases:

1. **REFINE** - Investigate and plan
2. **IMPLEMENT** - Execute subtasks
3. **REVIEW** - Self-assessment and validation
4. **COMPLETE** - Finalize and stop tracking
5. **GITHUB_PR** - Create pull request

### searxng-search

Web search and content extraction via SearXNG metasearch engine:

- No API keys required
- No rate limits
- Privacy-preserving (local instance)
- Aggregates results from multiple search engines
- Content extraction with Readability

## Extensions

### graphviz-chart

Renders Graphviz DOT specifications as PNG/SVG images. Useful for:

- Architecture diagrams
- Flowcharts
- State machines
- Dependency graphs

### vega-chart

Renders Vega-Lite specifications as PNG images. Useful for:

- Data visualizations
- Charts and graphs
- Statistical plots

## Docker Integration

These skills and extensions are copied into the pi-coding-agent Docker image at build time:

```dockerfile
COPY packages/chat-agent/skills/ /home/agent/.pi/agent/skills/
COPY packages/chat-agent/extensions/ /home/agent/.pi/agent/extensions/
```

Inside the container, the agent can access them via:

```bash
EDDO="${PI_CODING_AGENT_DIR}/skills/eddo-todo/eddo-todo.js"
```

## Service Access

### MCP Server

The eddo-todo skill connects to the Eddo MCP server via:

```bash
export EDDO_MCP_URL=http://host.docker.internal:3001/mcp
export EDDO_MCP_API_KEY=<user-api-key>
```

Both CLI entry points use the shared SDK v2 client, pinned to MCP revision `2026-07-28` without legacy fallback.
The client consumes structured results. Tool failures exit nonzero before printing success and never automatically retry mutations.
`eddo.js` delegates to `eddo-todo.js`, including calls from `eddo-worktree.js`.

Run skill client and CLI tests from the repository root:

```bash
pnpm vitest:run packages/chat-agent/skills/eddo-todo
```

Tests include real SDK exchanges, symlink-installed CLI execution, and subprocesses against disposable test HTTP endpoints.

### Skill Dependencies and Distribution

Run `pnpm install --frozen-lockfile` from the repository root for workspace and setup-created symlink installations.
Node resolves symlinked skill imports through their source directory and the chat-agent workspace dependencies.
The setup installer creates links; it does not install dependencies.

For an independently copied skill directory, install its committed lockfile from the repository root:

```bash
npm --prefix packages/chat-agent/skills/eddo-todo ci --omit=dev --ignore-scripts
```

Refresh the standalone lockfile after changing the skill dependency manifest:

```bash
npm --prefix packages/chat-agent/skills/eddo-todo install --package-lock-only --ignore-scripts
```

Keep the standalone SDK version aligned with the workspace dependency and `pnpm-lock.yaml`.
The image installs this lockfile in an isolated build stage, then copies its runtime dependencies.
See [container packaging and rollout](../../docker/pi-coding-agent/README.md#reproducible-todo-skill-packaging).
Rebuild the image and recreate existing containers alongside the current-protocol MCP service.

### SearXNG (Web Search)

The searxng-search skill connects to SearXNG running on the `eddo-chat` Docker network:

```bash
export SEARXNG_URL=http://searxng:8080
```

**Setup SearXNG:**

```bash
# From project root
./docker/searxng/docker.sh setup
```

This starts SearXNG on the `eddo-chat` network, making it accessible to agent containers at `http://searxng:8080` and to the host at `http://localhost:8080`.

**Managing SearXNG:**

```bash
./docker/searxng/docker.sh status   # Check status
./docker/searxng/docker.sh start    # Start container
./docker/searxng/docker.sh stop     # Stop container
./docker/searxng/docker.sh logs     # View logs
```
