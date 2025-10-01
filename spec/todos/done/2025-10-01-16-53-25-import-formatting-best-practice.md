# Web research and implement: 2025 best practice for auto-formatting and ordering file imports and "beautiful" type/code import separation

**Status:** Done
**Created:** 2025-10-01T16:53:25Z
**Started:** 2025-10-01T16:57:30Z
**Agent PID:** 70023

## Original Todo

web research and implement: 2025 best practice for auto-formatting and ordering file imports and "beautiful" type/code import separation

## Description

Switch from `@trivago/prettier-plugin-sort-imports` to `prettier-plugin-organize-imports` for automatic import formatting and organization. This plugin uses TypeScript's language service (same as VS Code's "Organize Imports" command) to automatically:

- Organize imports into logical groups
- Convert type-only imports to `import type` syntax
- Remove unused imports
- Sort imports alphabetically within groups

Current state: The codebase has inconsistent import patterns - mix of `import type` vs regular imports for types, inconsistent grouping of React/external/internal imports, and varying use of blank line separators.

## Success Criteria

### Functional Requirements

- [x] Functional: `prettier-plugin-organize-imports` installed and configured
- [x] Functional: `@trivago/prettier-plugin-sort-imports` removed from dependencies
- [x] Functional: Prettier config updated to use new plugin
- [x] Functional: All TypeScript files can be formatted without errors
- [x] Functional: Import organization follows TypeScript's language service rules (same as VS Code "Organize Imports")
- [x] Functional: Type-only imports automatically converted to `import type` syntax

### Quality Requirements

- [x] Quality: All TypeScript type checks pass (`pnpm tsc:check`)
- [x] Quality: All existing tests continue to pass (`pnpm test`)
- [x] Quality: ESLint runs without new errors (`pnpm lint`)
- [x] Quality: Prettier format check passes (`pnpm lint:format`)

### User Validation

- [x] User validation: Format command successfully organizes imports in sample files
- [x] User validation: Organized imports are readable and logically grouped
- [x] User validation: User confirms the import organization meets expectations

### Documentation

- [x] Documentation: Changes reflected in project-description.md if necessary

## Implementation Plan

### Code Modifications

- [x] Remove `@trivago/prettier-plugin-sort-imports` from package.json devDependencies (package.json:46)
- [x] Add `prettier-plugin-organize-imports` to package.json devDependencies (package.json:30-86)
- [x] Update prettier.config.cjs to use new plugin (prettier.config.cjs:1-15)
- [x] Remove import order configuration from prettier.config.cjs (prettier.config.cjs:8-14)

### Installation & Configuration

- [x] Run `pnpm install` to update dependencies

### Testing & Validation

- [x] Run `pnpm format` on a sample directory to test import organization
- [x] Run `pnpm tsc:check` to verify TypeScript compilation
- [x] Run `pnpm lint` to check for ESLint errors
- [x] Run `pnpm test` to ensure tests pass

### User Testing

- [x] User test: Review formatted imports in 2-3 sample files to verify organization is logical
- [x] User test: Confirm type-only imports are converted to `import type` syntax
- [x] User test: Verify no unexpected changes or broken imports

## Notes

### Implementation Results

Successfully migrated from `@trivago/prettier-plugin-sort-imports` to `prettier-plugin-organize-imports`. The new plugin uses TypeScript's language service API for import organization.

**Key improvements observed:**

1. Type imports properly use inline `type` keyword (e.g., `type DatabaseError`, `type FC`)
2. Unused React imports removed (project uses `"jsx": "react-jsx"` transform)
3. Imports organized in logical groups with alphabetical sorting within groups
4. Consistent blank line separation between external and internal imports
5. Type imports consolidated within the same import statement when from same module

**Quality checks:**

- TypeScript compilation: ✅ PASS
- ESLint: ✅ PASS
- Unit tests: ✅ 365 tests passed
- Prettier format check: ✅ PASS

**Files affected:**

- Configuration: `package.json`, `prettier.config.cjs`
- All TypeScript/TSX files formatted across packages: core-client, core-server, core-shared, mcp-server, telegram-bot, web-api, web-client
