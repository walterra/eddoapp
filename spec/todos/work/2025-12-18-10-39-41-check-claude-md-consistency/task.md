# Check consistency of items defined in CLAUDE.md coding style section with actual setup in repo
**Status:** In Progress
**Created:** 2025-12-18-10-39-41
**Started:** 2025-12-18-10-45-23
**Agent PID:** 97880

## Description
Audit coding style specifications in CLAUDE.md against actual repository configuration. Fix inconsistencies where CLAUDE.md specifies practical requirements that aren't implemented. Update CLAUDE.md to clarify aspirational vs required items.

**Success criteria:**
- Configuration files match CLAUDE.md specifications for practical requirements
- CLAUDE.md updated to distinguish required vs aspirational coding standards
- All linting, formatting, and type checking passes
- No contradictions between documented and actual setup

## Implementation Plan
- [ ] Fix Prettier line width: Add `printWidth: 100` (prettier.config.cjs:7)
- [ ] Fix TypeScript target: Change `es2017` to `ES2022` (tsconfig.json:3)
- [ ] Fix CLAUDE.md: Update prettier plugin reference from `@trivago/prettier-plugin-sort-imports` to `prettier-plugin-organize-imports` (CLAUDE.md:175)
- [ ] Add ESLint complexity guards: Add max-lines, max-lines-per-function, complexity, max-depth, max-params, max-nested-callbacks, max-statements rules (eslint.config.js:~50-70)
- [ ] Add ESLint strict rules: Add @typescript-eslint/no-explicit-any and no-unsafe-* rules (eslint.config.js:~35-40)
- [ ] Add test coverage configuration: Add coverage threshold to vitest.config.ts (vitest.config.ts:~15-20)
- [ ] Update CLAUDE.md: Add "Required vs Aspirational" section clarifying OpenTelemetry, fast-check, TestContainers, Result/Either patterns as future goals (CLAUDE.md:~140)
- [ ] Automated test: Run `pnpm lint` and verify complexity rules catch violations
- [ ] Automated test: Run `pnpm format` and verify 100-char line width
- [ ] Automated test: Run `pnpm tsc:check` and verify ES2022 target works
- [ ] Automated test: Run `pnpm test` and verify coverage thresholds
- [ ] User test: Review updated CLAUDE.md for clarity and completeness

## Review
- [ ] Bug/cleanup items if found

## Notes
[Important findings]
