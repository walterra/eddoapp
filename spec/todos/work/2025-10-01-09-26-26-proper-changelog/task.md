# Proper CHANGELOG - research 2025 best practices

**Status:** In Progress
**Created:** 2025-10-01T09:26:26
**Started:** 2025-10-01T09:30:00
**Agent PID:** 70023

## Original Todo

we need a proper CHANGELOG. web research 2025 best practice for this kind of project (for exampe commitizen with CHANGELOG integration). for comparison, check how ~/dev/astro-photostream maintains CHANGELOG, commit messages, releases, semver.

## Description

Implement a modern, automated CHANGELOG system using 2025 best practices for TypeScript monorepos, matching the approach used in astro-photostream. The eddo-app is a private monorepo application (not a library), so we'll implement:

1. **Changesets** - For version bumping and automated CHANGELOG generation
2. **Commitizen** - For interactive conventional commit messages
3. **Commitlint** - For enforcing conventional commit format via git hooks
4. **GitHub Releases** - Automated release creation on version bumps
5. **Single root CHANGELOG.md** - Tracking all changes across packages (no npm publishing)

This setup provides:

- Automated CHANGELOG generation from changeset files
- Enforced conventional commits for clean git history
- Automated GitHub releases via CI workflow
- Semantic versioning for deployment tracking

## Success Criteria

- [x] Functional: Changesets CLI installed and configured with proper config.json
- [x] Functional: `pnpm changeset` command creates changeset files successfully
- [x] Functional: `pnpm version` updates version numbers based on changesets
- [x] Functional: Commitizen installed and `pnpm commit` provides interactive commit prompt
- [x] Functional: Commitlint installed and validates commit messages via git hook
- [x] Functional: Husky git hooks properly configured (commit-msg and pre-commit)
- [x] Functional: Lint-staged runs on pre-commit hook
- [x] Functional: Initial CHANGELOG.md file created with proper format
- [x] Functional: GitHub Actions workflow for automated releases configured
- [x] Functional: Version bump script creates conventional commits
- [x] Quality: All dependencies added to package.json devDependencies
- [x] Quality: All TypeScript type checks pass
- [x] Quality: Configuration files match astro-photostream patterns
- [x] User validation: Can create a test changeset and generate changelog entry
- [x] User validation: Can make a commit using commitizen interactive prompt
- [x] User validation: Invalid commit messages are rejected by commitlint
- [x] Documentation: CHANGELOG workflow documented in CLAUDE.md

## Implementation Plan

### Configuration Files

- [x] Create `.changeset/config.json` with proper monorepo settings (.changeset/config.json)
- [x] Create `commitlint.config.js` with commit types and scopes for eddo-app (commitlint.config.js)
- [x] Create `.lintstagedrc.json` for pre-commit formatting/linting (.lintstagedrc.json)
- [x] Update `.husky/commit-msg` hook for commitlint (.husky/commit-msg)
- [x] Update `.husky/pre-commit` hook for lint-staged (.husky/pre-commit)

### Package Dependencies

- [x] Add changesets dependencies to root package.json (`@changesets/cli`) (package.json)
- [x] Add commitizen dependencies (`commitizen`, `cz-conventional-changelog`) (package.json)
- [x] Add commitlint dependencies (`@commitlint/cli`, `@commitlint/config-conventional`) (package.json)
- [x] Add lint-staged dependency (`lint-staged`) (package.json)

### Package Scripts

- [x] Add `pnpm commit` script for commitizen interactive prompt (package.json)
- [x] Add `pnpm changeset` script alias (package.json)
- [x] Add `pnpm changeset:add` script alias (package.json)
- [x] Add `pnpm changeset:status` script alias (package.json)
- [x] Add `pnpm version` script for changeset version bumping (package.json)
- [x] Add `pnpm release` script (no npm publish, just for CI workflow) (package.json)
- [x] Add config for commitizen in package.json (package.json)

### GitHub Release Automation

- [x] Create `scripts/version-packages.js` for automated version bumping (scripts/version-packages.js)
- [x] Create `.github/workflows/release.yml` for automated releases (.github/workflows/release.yml)

### CHANGELOG Setup

- [x] Create initial `CHANGELOG.md` at root with Keep a Changelog format (CHANGELOG.md)
- [x] Add Unreleased section to CHANGELOG.md (CHANGELOG.md)

### Automated Tests

- [x] Automated test: Run `pnpm install` to verify dependencies install correctly
- [x] Automated test: Run `pnpm tsc:check` to verify TypeScript compiles
- [x] Automated test: Run `pnpm lint` to verify linting passes
- [x] Automated test: Run `pnpm format` to verify formatting works

### User Tests

- [x] User test: Create a test changeset using `pnpm changeset`
- [x] User test: Make a commit using `pnpm commit` with interactive prompt
- [x] User test: Verify invalid commit message is rejected by commitlint
- [x] User test: Verify pre-commit hook runs lint-staged

### Documentation

- [x] Update CLAUDE.md with CHANGELOG workflow and release process (CLAUDE.md)

## Review

## Notes

- Added root package ('.') to pnpm-workspace.yaml to enable changesets for infrastructure changes
- Configured privatePackages.version=true in changeset config to allow versioning private packages
- Removed 'docs' from scope-enum to avoid overlap with 'docs' type
- Added 'changelog', 'release', and 'spec' scopes for infrastructure work
