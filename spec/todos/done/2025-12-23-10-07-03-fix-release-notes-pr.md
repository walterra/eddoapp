# Fix release notes PR not considering eddo-app updates only

**Status:** Done
**Created:** 2025-12-23-10-07-03
**Started:** 2025-12-23-10-15
**Agent PID:** 82340

## Description

The release notes process was updated to only include updates from the main app (eddo-app), but the PR created by the changesets action includes all packages (even those with only "Updated dependencies []" entries).

**Goal:** PR body should only show the eddo-app section, not all the individual package sections with empty dependency updates.

**How we'll know it works:**

- The release PR body shows only the eddo-app changelog entries
- Individual package changelog sections (like @eddo/web-client, @eddo/core-shared, etc.) with only "Updated dependencies" entries are filtered out

## Implementation Plan

Replace changesets/action with custom PR creation script for full control over PR body.

- [x] Create `scripts/create-release-pr.js` - Custom script to:
  - Check for pending changesets
  - Create/switch to `changeset-release/main` branch
  - Run `pnpm changeset version` + cleanup
  - Commit version changes
  - Push branch
  - Create/update PR with eddo-app-only changelog in body
- [x] Update `.github/workflows/release.yml` - Replace changesets/action with custom script
- [x] Automated test: Unit test for changelog extraction logic (scripts/create-release-pr.test.js)
- [x] User test: Skipped (will verify in production)

## Review

- [x] Code quality: Script follows project conventions (JSDoc, error handling)
- [x] Unit tests: 8 tests covering changelog extraction and PR body generation
- [x] All unit tests passing (460 tests)
- [x] Lint check: No errors (only pre-existing warnings)
- [x] TypeScript check: Passes

## Notes

- GitHub Issue: https://github.com/walterra/eddoapp/issues/290
- Reference PR: https://github.com/walterra/eddoapp/pull/278
- The changesets/action doesn't support filtering PR body content. Custom script gives full control.

### Files Changed

- `scripts/create-release-pr.js` - New custom release PR script
- `scripts/create-release-pr.test.js` - Unit tests for changelog extraction
- `.github/workflows/release.yml` - Updated to use custom script instead of changesets/action
- `vitest.config.ts` - Added test file to unit test includes
