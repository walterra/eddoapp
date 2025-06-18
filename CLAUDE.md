# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

- Build: `pnpm build`
- Dev server: `pnpm dev`
- Lint: `pnpm lint`
- Format check: `pnpm lint:format`
- Format fix: `pnpm format`
- Full test suite: `pnpm test`
- Run single test: `pnpm vitest:run src/path/to/file.test.ts`
- TypeScript check: `pnpm tsc:check`

## Architecture Overview

This is a GTD-inspired todo and time tracking application built with React, TypeScript, and PouchDB.

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

### Key Directories

- `/src/api/versions/`: Data model versions and migration functions
- `/src/components/`: React components (flat structure)
- `/src/types/`: TypeScript definitions
- `/src/utils/`: Utility functions with co-located tests

## Code Style

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
- Do not add author or generator notes into git commit messages
