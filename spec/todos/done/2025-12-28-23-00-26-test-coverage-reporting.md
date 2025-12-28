# Add test coverage reporting with minimum thresholds

**Status:** Done
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

- [x] **Add `test:coverage` script** (package.json)
- [x] **Update CI to run coverage** (.github/workflows/test.yml) - replace `pnpm test:unit` with coverage
- [x] **Set realistic thresholds** (vitest.config.ts) - lines: 10%, functions: 40%, branches: 50%, statements: 10%
- [x] **Automated test:** Run `pnpm test:coverage` locally, verify reports generated
- [x] **Automated test:** Verify CI would fail with artificially low threshold (tested with 90% lines threshold → ERROR)

## Review

- [ ] Bug/cleanup items if found

## Notes

- Current coverage baseline: 52.63% lines, 80.46% branches, 79.82% functions
- Thresholds set conservatively to allow for fluctuation while preventing major regressions
- Coverage HTML report generated in `coverage/` directory
- `@vitest/coverage-v8@^3.2.4` dependency installed (matches vitest version)
