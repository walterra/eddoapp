# Multi-Agent Development Workflows

Research compiled January 2026 on approaches to running multiple AI coding agents in parallel while maintaining code quality, PR workflows, and human-in-the-loop testing.

## Table of Contents

- [Overview](#overview)
- [Approaches](#approaches)
  - [1. YOLO Mode (Single Branch)](#1-yolo-mode-single-branch)
  - [2. Git Worktrees + Per-Worktree Dev Servers](#2-git-worktrees--per-worktree-dev-servers)
  - [3. Docker-Based Full Isolation](#3-docker-based-full-isolation)
  - [4. Hybrid Approaches](#4-hybrid-approaches)
- [Human-in-the-Loop Testing](#human-in-the-loop-testing)
- [Implementation Patterns](#implementation-patterns)
- [Tools and Resources](#tools-and-resources)
- [Recommendations for Eddo](#recommendations-for-eddo)

## Overview

As AI coding agents become daily drivers for development, teams face a new challenge: how to run multiple agents in parallel while maintaining:

- Code quality through PR reviews
- Ability to manually test changes against running dev servers
- Isolation between agent workstreams
- Efficient resource usage

The approaches range from "full YOLO" (multiple agents on same branch) to complete isolation (Docker container per agent with dedicated infrastructure).

## Approaches

### 1. YOLO Mode (Single Branch)

**Pioneered by:** Peter Steinberger ([steipete.me](https://steipete.me/posts/just-talk-to-it))

**How it works:**

- Run 3-8 agents in parallel in a terminal grid (e.g., 3×3 layout)
- All agents work on the **same branch in the same folder**
- Rely on atomic commits with strict agent instructions to avoid conflicts
- Single dev server that you manually test against
- Think in terms of "blast radius" - small, independent changes minimize interference

**Setup:**

```bash
# Terminal grid with multiple agent instances
# All pointing to the same directory
cd ~/project
codex "implement feature A"  # Terminal 1
codex "fix bug B"            # Terminal 2
codex "refactor module C"    # Terminal 3
```

**Agent instructions (from Steinberger's CLAUDE.md):**

```markdown
- Commit only files you directly modified
- Use atomic commits with clear messages
- Don't touch files other agents are working on
```

**Advantages:**

- Fastest iteration speed
- No merge conflicts to resolve
- Single dev server to test against
- Minimal infrastructure overhead

**Disadvantages:**

- Requires discipline and well-defined agent boundaries
- Risky for teams (no code review gate)
- Can lead to conflicting changes if agents overlap
- Not suitable for all project types

**Best for:** Solo developers, rapid prototyping, projects with clear module boundaries.

---

### 2. Git Worktrees + Per-Worktree Dev Servers

**The emerging "best practice" for teams wanting PRs**

Git worktrees allow multiple working directories from a single repository, each on a different branch, sharing the same `.git` directory.

**Directory structure:**

```
project/
├── main/                    # Main working directory
└── .trees/
    ├── feature-auth/        # Agent 1: OAuth feature (branch: feature/auth)
    ├── feature-ui/          # Agent 2: UI improvements (branch: feature/ui)
    └── hotfix-payment/       # Agent 3: Critical fix (branch: hotfix/payment)
```

**Basic commands:**

```bash
# Create worktree with new branch
git worktree add .trees/feature-auth -b feature/auth

# Create worktree from existing branch
git worktree add .trees/feature-ui feature/ui

# List all worktrees
git worktree list

# Remove worktree when done
git worktree remove .trees/feature-auth
```

**Key challenge: Port allocation**

Each worktree needs its own dev server instances on different ports:

```bash
# Main development
web-api:3000, mcp-server:3002, web-client:5173

# Worktree 1 (feature-auth)
web-api:3100, mcp-server:3102, web-client:5273

# Worktree 2 (feature-ui)
web-api:3200, mcp-server:3202, web-client:5373
```

**Advantages:**

- Complete code isolation between features
- Standard PR workflow preserved
- Easy to abandon failed experiments (just remove worktree)
- All worktrees share git history (fetch once, available everywhere)
- No repository duplication

**Disadvantages:**

- Port management overhead
- Multiple dev server instances consume resources
- Need strategy for shared vs isolated databases
- Context switching for human testing requires knowing which ports to use

**Best for:** Teams, projects requiring code review, parallel feature development.

**Helpful tools:**

- [`@johnlindquist/worktree`](https://github.com/johnlindquist/worktree-cli) - CLI for easier worktree management
- Cursor's "Parallel Agents" feature (uses worktrees internally)

---

### 3. Docker-Based Full Isolation

**Maximum isolation with containerized environments per agent**

Each agent gets a completely isolated stack with its own containers.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Dashboard                         │
│  (WebSocket connections, approval UI, task management)       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  brave-fox      │  │  swift-eagle    │  │  calm-bear      │
│  ────────────── │  │  ────────────── │  │  ────────────── │
│  PostgreSQL     │  │  PostgreSQL     │  │  PostgreSQL     │
│  Backend:3100   │  │  Backend:3200   │  │  Backend:3300   │
│  Frontend:5100  │  │  Frontend:5200  │  │  Frontend:5300  │
│  Claude CLI     │  │  Claude CLI     │  │  Claude CLI     │
│  Web Terminal   │  │  Web Terminal   │  │  Web Terminal   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Docker Compose pattern:**

```yaml
# docker-compose.agent.yml
version: '3.8'
services:
  database:
    image: postgres:16
    environment:
      POSTGRES_DB: ${AGENT_NAME}_db
    ports:
      - '${DB_PORT}:5432'

  backend:
    build: .
    environment:
      DATABASE_URL: postgresql://...
      PORT: 3000
    ports:
      - '${API_PORT}:3000'
    depends_on:
      - database

  frontend:
    build: ./frontend
    ports:
      - '${WEB_PORT}:5173'
```

**Spawning agents:**

```bash
# Each agent gets unique project name and ports
COMPOSE_PROJECT_NAME=brave-fox \
  API_PORT=3100 \
  WEB_PORT=5100 \
  DB_PORT=5532 \
  docker compose -f docker-compose.agent.yml up -d
```

**Key features from real implementations:**

- Memorable worker names (brave-fox, swift-eagle) instead of UUIDs
- On-demand services: Backend/frontend only start when needed
- Web terminal access (ttyd on :7681) for debugging
- Git push approval: Human-in-the-loop before any remote push
- Auto branch naming from task description

**Advantages:**

- Complete isolation (no interference possible)
- Each agent has clean environment
- Easy to destroy and recreate
- Can run different configurations per agent

**Disadvantages:**

- Resource intensive (multiple databases, servers)
- More complex setup
- Slower to spin up new agents
- Overkill for many use cases

**Best for:** Complex projects, agents that need different environments, maximum safety.

---

### 4. Hybrid Approaches

**Shared infrastructure with isolated application code**

A middle ground that shares expensive resources while isolating code:

```
┌─────────────────────────────────────────────────────────────┐
│                   Shared Infrastructure                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  CouchDB    │  │  Redis      │  │  Other Services     │  │
│  │  :5984      │  │  :6379      │  │  (shared)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Worktree 1     │  │  Worktree 2     │  │  Worktree 3     │
│  API:3100       │  │  API:3200       │  │  API:3300       │
│  MCP:3102       │  │  MCP:3202       │  │  MCP:3302       │
│  Web:5173       │  │  Web:5273       │  │  Web:5373       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**When to share vs isolate:**

| Resource      | Share                              | Isolate                                   |
| ------------- | ---------------------------------- | ----------------------------------------- |
| Database      | When agents work on different data | When testing migrations or schema changes |
| Cache         | Usually safe to share              | When testing cache logic                  |
| External APIs | Rate limits may require isolation  | Usually safe to share                     |
| File storage  | When working on different files    | When testing upload/storage features      |

---

## Human-in-the-Loop Testing

**The least-solved problem in multi-agent development**

Current state of tooling focuses on code generation but ignores the need for humans to manually test running applications.

### The Problem

1. Agent writes code and creates PR
2. Human wants to test the feature manually
3. Human needs to:
   - Know which environment corresponds to which agent/PR
   - Have the right dev servers running
   - Point their browser/tools at the correct ports

### Emerging Solutions

**1. Agent Dashboard**
A central UI showing:

- All active agents and their tasks
- Dev server URLs for each agent
- Status (running, stopped, needs approval)
- One-click access to each environment

**2. Subdomain Routing with Reverse Proxy**

```nginx
# nginx or Caddy configuration
feature-auth.local.dev → localhost:3100
feature-ui.local.dev   → localhost:3200
main.local.dev         → localhost:3000
```

**3. Browser Extension**
Switch API endpoints without changing code:

```javascript
// Extension intercepts requests
// Redirects based on active "environment" selection
api.example.com → localhost:3100 (when "feature-auth" selected)
```

**4. Preview Environments (CI/CD)**
Like Vercel preview deploys:

- Each PR gets a deployed preview URL
- Links posted to PR automatically
- No local setup required for testing

---

## Implementation Patterns

### Pattern 1: Simple Worktree Script

```bash
#!/bin/bash
# scripts/new-agent-worktree.sh

FEATURE_NAME=$1
PORT_OFFSET=$2

# Create worktree
git worktree add .trees/$FEATURE_NAME -b feature/$FEATURE_NAME

# Create .env with port offsets
cat > .trees/$FEATURE_NAME/.env.local << EOF
API_PORT=$((3000 + PORT_OFFSET * 100))
MCP_PORT=$((3002 + PORT_OFFSET * 100))
WEB_PORT=$((5173 + PORT_OFFSET * 100))
EOF

echo "Created worktree: .trees/$FEATURE_NAME"
echo "API: http://localhost:$((3000 + PORT_OFFSET * 100))"
echo "MCP: http://localhost:$((3002 + PORT_OFFSET * 100))"
echo "Web: http://localhost:$((5173 + PORT_OFFSET * 100))"
```

### Pattern 2: Docker Compose with Environment Variables

```yaml
# docker-compose.dev.yml
services:
  api:
    build: ./packages/web-api
    ports:
      - '${API_PORT:-3000}:3000'
    environment:
      - MCP_SERVER_URL=http://mcp:${MCP_PORT:-3002}

  mcp:
    build: ./packages/mcp-server
    ports:
      - '${MCP_PORT:-3002}:3002'

  web:
    build: ./packages/web-client
    ports:
      - '${WEB_PORT:-5173}:5173'
```

### Pattern 3: Active Environments Tracker

```markdown
<!-- .trees/ACTIVE_ENVIRONMENTS.md -->

# Active Agent Environments

| Agent   | Branch       | API   | Web   | Status  | Task                 |
| ------- | ------------ | ----- | ----- | ------- | -------------------- |
| agent-1 | feature/auth | :3100 | :5173 | Running | OAuth implementation |
| agent-2 | feature/ui   | :3200 | :5273 | Stopped | UI refresh           |
| agent-3 | fix/bug-123  | :3300 | :5373 | Running | Payment fix          |

Last updated: 2026-01-08 14:30
```

---

## Tools and Resources

### Git Worktree Tools

- [worktree-cli](https://github.com/johnlindquist/worktree-cli) - Streamlined worktree management
- Native `git worktree` commands

### Multi-Agent Orchestration

- [Docker Compose for Agents](https://github.com/docker/compose-for-agents) - Docker's official agent tooling
- [cagent](https://github.com/docker/cagent) - Docker's multi-agent runtime
- [HumanLayer/CodeLayer](https://github.com/humanlayer/humanlayer) - Multi-Claude orchestration

### Agent Harnesses

- [Claude Code](https://claude.ai/code) - Anthropic's CLI agent
- [Codex CLI](https://github.com/openai/codex) - OpenAI's CLI agent
- [Cursor](https://cursor.com) - IDE with parallel agents feature
- [pi-coding-agent](https://github.com/badlogic/pi-mono) - Minimal, customizable agent harness

### Articles and Discussions

- [Peter Steinberger: Just Talk To It](https://steipete.me/posts/just-talk-to-it) - YOLO workflow
- [Nx Blog: Git Worktrees for AI Agents](https://nx.dev/blog/git-worktrees-ai-agents)
- [Using Git Worktrees for Multi-Feature Development](https://www.nrmitchi.com/2025/10/using-git-worktrees-for-multi-feature-development-with-ai-agents/)

---

## Recommendations for Eddo

Given Eddo's architecture (web-api, mcp-server, telegram-bot, CouchDB), here's a suggested approach:

### Phase 1: Worktrees + Port Offsets (Low Friction)

1. **Add port configuration support** to all services via environment variables
2. **Create worktree helper script** that:
   - Creates worktree with memorable name
   - Sets port offset based on worktree index
   - Generates `.env.local` with correct ports
   - Prints URLs for human testing

3. **Keep single CouchDB instance** - agents typically work on different data anyway

4. **Document active environments** in a simple markdown file or JSON

### Phase 2: Agent Dashboard (When Needed)

If running multiple agents becomes common:

- Simple web UI listing active worktrees
- Links to each environment's services
- Start/stop controls for dev servers
- Git status and recent commits per worktree

### Phase 3: Preview Environments (For Team Scale)

When the team grows:

- CI/CD preview deploys for each PR
- Automatic environment URLs posted to PRs
- No local setup required for reviewers

### Configuration Changes Needed

```typescript
// packages/web-api/src/config.ts
export const config = {
  port: parseInt(process.env.API_PORT || '3000'),
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3002',
  // ...
};

// packages/mcp-server/src/config.ts
export const config = {
  port: parseInt(process.env.MCP_PORT || '3002'),
  // ...
};
```

### Example Workflow

```bash
# Create new worktree for agent
./scripts/new-worktree.sh github-sync 1

# Agent works in that directory
cd .trees/github-sync
pi "implement GitHub issue sync"

# Human tests at the provided URLs
# API: http://localhost:3100
# Web: http://localhost:5273

# When done, create PR and clean up
git push -u origin feature/github-sync
cd ../..
git worktree remove .trees/github-sync
```

---

## Open Questions

1. **Database isolation**: When should agents get their own database vs share?
2. **Resource limits**: How many parallel agents before performance degrades?
3. **Conflict resolution**: Best practices when agents' changes overlap?
4. **Cost tracking**: How to attribute API costs to specific agents/tasks?
5. **Automatic cleanup**: When to garbage-collect abandoned worktrees?

---

_This document reflects the state of multi-agent development practices as of January 2026. The field is evolving rapidly._
