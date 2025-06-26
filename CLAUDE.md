# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

### Root Level
- Build all packages: `pnpm build`
- Dev server (client): `pnpm dev`
- Lint: `pnpm lint`
- Format check: `pnpm lint:format`
- Format fix: `pnpm format`
- Full test suite: `pnpm test`
- Run single test: `pnpm vitest:run src/path/to/file.test.ts`
- TypeScript check: `pnpm tsc:check`

### Package-Specific
- Client dev: `pnpm dev:client`
- Server dev: `pnpm dev:server`
- Telegram bot dev: `pnpm dev:telegram-bot`
- Build specific package: `pnpm build:client|server|shared|telegram-bot`

## Architecture Overview

This is a GTD-inspired todo and time tracking application built as a monorepo with multiple packages:

- **client**: React/TypeScript frontend with PouchDB for offline-first storage
- **server**: MCP (Model Context Protocol) server for external integrations
- **shared**: Common types, utilities, and data models across packages
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

- `packages/client/src/`: React frontend application
  - `components/`: React components (flat structure)
  - `hooks/`: Custom React hooks
- `packages/shared/src/`: Shared code across packages
  - `api/versions/`: Data model versions and migration functions
  - `types/`: TypeScript definitions
  - `utils/`: Utility functions with co-located tests
- `packages/server/src/`: MCP server implementation
- `packages/telegram-bot/src/`: Telegram bot with AI agent
  - `agent/`: Simple agent loop implementation
  - `ai/`: Claude integration and persona management
  - `bot/`: Telegram bot handlers and commands
  - `mcp/`: MCP client integration

## Code Style

- IMPORTANT: Prefer functional style with factories instead of object-oriented style
- Use minimal/lightweight TypeScript-style JSDoc to document code
- Use snake_case for filenames
- Use camelCase for variables/functions, PascalCase for components/types
- Single quotes, trailing commas
- Tests use describe/it pattern with Vitest
- Place test files alongside implementation with .test.ts/.test.tsx extension
- Use typed imports and exports with TypeScript
- Use explicit return types for functions
- Follow existing import sorting (uses @trivago/prettier-plugin-sort-imports)
- Use TailwindCSS for styling
- Use try/catch for error handling with console.error
- Use Prettier for formatting with existing config

## Git Rules

- Use CC (Conventional Commit) prefixes for commit messages
- Do not add "Generated with" or "Co-authored" sections to commit messages

## AI Agent Development Guidelines

When working on AI agent code (especially in the telegram-bot package), follow these principles:

### Core Philosophy: Simplicity First
- **Agents are just "for loops with LLM calls"** - avoid over-engineering
- Prefer minimal recursive loops over complex state machines
- Trust the LLM to orchestrate its own workflow rather than imposing rigid patterns

### Implementation Patterns
1. **Simple Agent Loop Structure**:
   ```typescript
   async function agentLoop(userInput: string, context: BotContext) {
     let state = { input: userInput, history: [] };
     while (!state.done) {
       const llmResponse = await processWithLLM(state);
       if (llmResponse.needsTool) {
         state = await executeTool(llmResponse.tool, state);
       } else {
         state.done = true;
       }
       state.history.push(llmResponse);
     }
     return state.output;
   }
   ```

2. **Avoid Complex Abstractions**:
   - NO: Graph-based workflows, state machines, rigid node systems
   - YES: Simple loops, direct tool calls, minimal state

3. **Tool Integration**:
   - Fetch MCP tool definitions dynamically from server
   - Pass tool descriptions directly to LLM in system prompt
   - Let the LLM select tools based on descriptions, not complex routing

4. **State Management**:
   - Keep state minimal: current input, history, context
   - Store conversation history in simple data structures (Map, Array)
   - Avoid complex state objects with 20+ fields

5. **Error Handling**:
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
