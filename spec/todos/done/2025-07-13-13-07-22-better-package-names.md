# come up with better names for the packages

**Status:** Done
**Started:** 2025-07-13T13:07:45
**Created:** 2025-07-13T13:07:22
**Agent PID:** 1664

## Original Todo

- come up with better names for the packages

## Description

The task involves improving the naming of packages in the Eddo monorepo. Currently, the packages use functional but generic names (`@eddo/client`, `@eddo/server`, `@eddo/shared`, `@eddo/telegram-bot`). 

The "Eddo" brand name itself is well-established and consistent throughout the application. The potential improvements could focus on:

1. **More descriptive package names** that better reflect their specific purposes
2. **Domain-specific naming** that relates to GTD/productivity concepts  
3. **Consistency improvements** between technical names and user-facing descriptions

**Current packages:**
- `@eddo/client` - React frontend for GTD todo management
- `@eddo/server` - MCP server for external tool integration  
- `@eddo/shared` - Common types, utilities, and data models
- `@eddo/telegram-bot` - AI-powered Telegram bot interface

## Implementation Plan

**Code modifications:**
- [x] Rename package directories:
  - [x] `packages/client/` → `packages/web_client/`
  - [x] `packages/server/` → `packages/mcp_server/`
  - [x] `packages/shared/` → `packages/core/`
  - [x] `packages/telegram-bot/` → `packages/telegram_bot/` (for consistency)
- [x] Update root package.json workspace configuration and scripts (package.json:8-15)
- [x] Update each package's package.json with new names:
  - [x] `@eddo/client` → `@eddo/web-client` (packages/web_client/package.json:2)
  - [x] `@eddo/server` → `@eddo/mcp-server` (packages/mcp_server/package.json:2)
  - [x] `@eddo/shared` → `@eddo/core` (packages/core/package.json:2)
  - [x] `@eddo/telegram-bot` → `@eddo/telegram-bot` (packages/telegram_bot/package.json:2)
- [x] Update all import statements across 38 files using systematic find/replace
- [x] Update TypeScript path mappings in tsconfig files (tsconfig.json:5-15)
- [x] Update Vite configuration aliases (vite.config.ts:10-20, packages/web_client/vite.config.ts:15-25)
- [x] Update any file paths in scripts and configuration files
- [x] Regenerate pnpm-lock.yaml file

**Automated tests:**
- [x] Automated test: Run `pnpm tsc:check` to verify all imports resolve correctly
- [x] Automated test: Run `pnpm build` to ensure build process works with new names
- [x] Automated test: Run `pnpm test` to verify no broken imports in test files

## Notes

- Successfully renamed all package directories and updated package.json files
- Updated all import statements from @eddo/shared to @eddo/core across the entire codebase
- Fixed TypeScript project references in root and individual package tsconfigs
- Updated Vite configuration aliases and optimizeDeps
- Regenerated pnpm-lock.yaml with new package structure
- All automated tests pass: TypeScript compilation, build process, and unit tests

**User tests:**
- [ ] User test: Verify client application loads and functions correctly
- [ ] User test: Verify MCP server can be started and responds to tool calls
- [ ] User test: Verify Telegram bot can connect and interact with MCP server
- [ ] User test: Verify all pnpm scripts work with new package names

**New structure:**
- `packages/web_client/` → `@eddo/web-client` - React web interface
- `packages/mcp_server/` → `@eddo/mcp-server` - MCP server for external integrations
- `packages/core/` → `@eddo/core` - Core utilities and types
- `packages/telegram_bot/` → `@eddo/telegram-bot` - Telegram bot interface