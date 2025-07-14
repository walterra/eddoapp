# read spec/todos/done/2025-07-13-13-07-22-better-package-names.md - it looks like we missed renaming some references across the codebase. check the code base for old package names and update everywereh.

**Status:** In Progress
**Created:** 2025-07-14T21:15:29
**Started:** 2025-07-14T21:16:45
**Agent PID:** 1664

## Original Todo

read spec/todos/done/2025-07-13-13-07-22-better-package-names.md - it looks like we missed renaming some references across the codebase. check the code base for old package names and update everywereh.

## Description

After the previous package renaming task, there are still 71 references to old package names scattered throughout the codebase. These include:

- `@eddo/client` should be `@eddo/web-client`
- `@eddo/server` should be `@eddo/mcp-server`  
- `@eddo/shared` should be `@eddo/core`
- `packages/client` should be `packages/web_client`
- `packages/server` should be `packages/mcp_server`
- `packages/shared` should be `packages/core`
- `packages/telegram-bot` should be `packages/telegram_bot`

The references are primarily in documentation files, configuration files, and one active code file. This cleanup is important for maintaining consistency and avoiding confusion.

## Implementation Plan

**Code modifications:**
- [x] Update critical configuration files:
  - [x] `CLAUDE.md` - Update package structure references (line 91, 94, 98, 99)
  - [x] `knip.json` - Update package paths (lines 19, 33, 45, 58)
  - [x] `tailwind.config.cjs` - Update content paths (lines 4-5)
  - [x] `spec/project-description.md` - Update package structure (lines 30-33)
- [x] Update active code files:
  - [x] `packages/mcp_server/src/integration-tests/setup/test-mcp-server.ts` - Fix package name reference (line 67)
- [x] Update development documentation:
  - [x] Files in `/dev/` directory (11 files with old references)
  - [x] Files in `/spec/todos/done/` directory (multiple files)
- [x] Update README files:
  - [x] `packages/telegram_bot/README.md` - Update package references

**Automated tests:**
- [x] Automated test: Run `pnpm tsc:check` to verify all references are valid
- [x] Automated test: Run `pnpm lint` to ensure code style compliance  
- [x] Automated test: Run `pnpm build` to verify build process works
- [x] Automated test: Run `pnpm test` to ensure no broken imports

**User tests:**
- [x] User test: Verify all pnpm scripts work correctly
- [x] User test: Verify MCP server integration tests still pass
- [x] User test: Verify development documentation is accurate