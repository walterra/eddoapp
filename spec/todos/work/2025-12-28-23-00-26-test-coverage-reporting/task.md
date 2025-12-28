# Add test coverage reporting with minimum thresholds

**Status:** In Progress
**Created:** 2025-12-28-23-00-26
**Started:** 2025-12-28-23-10
**Agent PID:** 51644
**GitHub Issue:** #34

## Description

Add test coverage with threshold enforcement:

- `pnpm test:coverage` script for local use
- CI fails if coverage drops below thresholds

**Success Criteria:**

- `pnpm test:coverage` generates coverage reports locally
- CI enforces coverage thresholds (fails if too low)

## Implementation Plan

- [ ] **Add `test:coverage` script** (package.json)
- [ ] **Update CI to run coverage** (.github/workflows/test.yml) - replace `pnpm test:unit` with coverage
- [ ] **Set realistic thresholds** (vitest.config.ts) - based on current coverage baseline
- [ ] **Automated test:** Run `pnpm test:coverage` locally, verify reports generated
- [ ] **Automated test:** Verify CI would fail with artificially low threshold

## Review

- [ ] Bug/cleanup items if found

## Notes

- Current vitest.config.ts already has coverage configuration with 70% thresholds
- `@vitest/coverage-v8@^3.2.4` dependency installed (matches vitest version)
- Need to determine realistic thresholds by running coverage first
