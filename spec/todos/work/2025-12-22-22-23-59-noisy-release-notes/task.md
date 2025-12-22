# Noisy release notes - Show only main eddo-app, skip individual packages

**Status:** Refining
**Created:** 2025-12-22-22-23-59
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

- [ ] Modify `scripts/aggregate-changelog.js` to skip individual packages (lines 70-92)
- [ ] Simplify output to only include root CHANGELOG.md content
- [ ] Remove "Root Package" header (redundant when only showing root)
- [ ] Automated test: Run script locally and verify output contains only root content
- [ ] User test: Check output format matches expectations (version header + root changelog only)

## Review

- [ ] Bug/cleanup items if found

## Notes

[Important findings]
