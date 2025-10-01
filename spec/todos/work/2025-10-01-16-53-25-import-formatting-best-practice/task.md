# Web research and implement: 2025 best practice for auto-formatting and ordering file imports and "beautiful" type/code import separation

**Status:** Refining
**Created:** 2025-10-01T16:53:25Z
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

- [ ] Functional: `prettier-plugin-organize-imports` installed and configured
- [ ] Functional: `@trivago/prettier-plugin-sort-imports` removed from dependencies
- [ ] Functional: Prettier config updated to use new plugin
- [ ] Functional: All TypeScript files can be formatted without errors
- [ ] Functional: Import organization follows TypeScript's language service rules (same as VS Code "Organize Imports")
- [ ] Functional: Type-only imports automatically converted to `import type` syntax

### Quality Requirements

- [ ] Quality: All TypeScript type checks pass (`pnpm tsc:check`)
- [ ] Quality: All existing tests continue to pass (`pnpm test`)
- [ ] Quality: ESLint runs without new errors (`pnpm lint`)
- [ ] Quality: Prettier format check passes (`pnpm lint:format`)

### User Validation

- [ ] User validation: Format command successfully organizes imports in sample files
- [ ] User validation: Organized imports are readable and logically grouped
- [ ] User validation: User confirms the import organization meets expectations

### Documentation

- [ ] Documentation: Changes reflected in project-description.md if necessary

## Implementation Plan

### Code Modifications

- [ ] Remove `@trivago/prettier-plugin-sort-imports` from package.json devDependencies (package.json:46)
- [ ] Add `prettier-plugin-organize-imports` to package.json devDependencies (package.json:30-86)
- [ ] Update prettier.config.cjs to use new plugin (prettier.config.cjs:1-15)
- [ ] Remove import order configuration from prettier.config.cjs (prettier.config.cjs:8-14)

### Installation & Configuration

- [ ] Run `pnpm install` to update dependencies

### Testing & Validation

- [ ] Run `pnpm format` on a sample directory to test import organization
- [ ] Run `pnpm tsc:check` to verify TypeScript compilation
- [ ] Run `pnpm lint` to check for ESLint errors
- [ ] Run `pnpm test` to ensure tests pass

### User Testing

- [ ] User test: Review formatted imports in 2-3 sample files to verify organization is logical
- [ ] User test: Confirm type-only imports are converted to `import type` syntax
- [ ] User test: Verify no unexpected changes or broken imports
