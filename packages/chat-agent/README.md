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
│   │   ├── eddo.js
│   │   └── package.json
│   └── eddo-work/          # Structured work phases
│       └── SKILL.md
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

## MCP Server Access

The eddo-todo skill connects to the Eddo MCP server. Inside Docker containers, this is configured via:

```bash
export EDDO_MCP_URL=http://host.docker.internal:3001/mcp
```

This allows the containerized agent to reach the MCP server running on the host.
