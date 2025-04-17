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
