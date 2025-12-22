# Noisy release notes - Show only main eddo-app, skip individual packages

**Status:** Done
**Created:** 2025-12-22-22-23-59
**Started:** 2025-12-22 22:26:47
**Agent PID:** 98482

## Description

**Problem:** GitHub release notes aggregate changelogs from all 8 individual packages (web-client, web-api, core-shared, etc.) plus the root package, creating noisy output with duplicate information and "Updated dependencies" sections. Example: https://github.com/walterra/eddoapp/pull/278

**Solution:** Modify `scripts/aggregate-changelog.js` to show ONLY the root `CHANGELOG.md` content (eddo-app package), skipping all individual package changelogs. The root changelog already contains a high-level summary of all changes across packages.

**Success Criteria:**

- GitHub release notes contain only root package changelog
- No individual package sections (web-client, web-api, etc.)
- No "Updated dependencies" noise
- Release notes are concise and user-focused

## Implementation Plan

- [x] Modify `scripts/aggregate-changelog.js` to skip individual packages (lines 70-92)
- [x] Simplify output to only include root CHANGELOG.md content
- [x] Remove "Root Package" header (redundant when only showing root)
- [x] Automated test: Run script locally and verify output contains only root content
- [x] User test: Check output format matches expectations (version header + root changelog only)

## Review

- [x] Edge case testing completed:
  - ✅ Missing CHANGELOG.md → Returns "No changelog entries found"
  - ✅ Version not found in changelog → Returns "No changelog entries found"
  - ✅ Empty version section → Returns "No changelog entries found"
  - ✅ Multiple versions in changelog → Correctly extracts target version
- [x] Code quality review:
  - ✅ Follows functional programming patterns
  - ✅ Pure functions with single responsibility
  - ✅ Proper error handling via existence checks
  - ✅ Documentation accurately reflects behavior
  - ✅ No hardcoded values or magic numbers
- [x] Integration with GitHub Actions workflow verified
- [x] No bugs or cleanup items identified

## Notes

**Implementation Details:**

- Removed package iteration loop (lines 70-92)
- Removed unused `PACKAGES_DIR` constant
- Updated file documentation to reflect new behavior
- Script now outputs only root CHANGELOG.md content
- Reduces release notes from 9 sections to 1 clean section

**Test Results:**

- ✅ Script executes successfully: `node scripts/aggregate-changelog.js`
- ✅ Output format: `# Release v0.1.0` + root changelog content only
- ✅ Prettier formatting passed
- ✅ ESLint checks passed (no errors/warnings)
- ✅ TypeScript compilation passed
