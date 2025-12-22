# Use @testcontainers for integration/e2e tests

**Status:** Refining
**Created:** 2025-12-22-23-05-26
**Agent PID:** 98482

## Description

Replace manual CouchDB setup with Testcontainers for integration/e2e tests. Uses best practice pattern: one container per test suite (starts in globalSetup, stops in globalTeardown), with fast database cleanup between individual tests. Developers will no longer need to manually start CouchDB. Success criteria: all integration and e2e tests pass without requiring external CouchDB instance, works locally and in CI.

## Implementation Plan

- [ ] Install @testcontainers/couchdb dependency (package.json)
- [ ] Create global testcontainer setup (test/global-testcontainer-setup.ts)
  - Start CouchDB container in setup function
  - Store container URL in global state/env for tests
  - Stop container in teardown function
  - Add ~5 second timeout for container startup
- [ ] Create E2E global setup (test/e2e-global-setup.ts)
  - Import and call testcontainer setup
  - Export setup/teardown functions for vitest
- [ ] Create Integration global setup (test/integration-global-setup.ts)
  - Import and call testcontainer setup
  - Export setup/teardown functions for vitest
- [ ] Update vitest.config.ts
  - Add globalSetup/globalTeardown to e2e project
  - Point to test/e2e-global-setup.ts
- [ ] Update packages/mcp_server/vitest.integration.config.ts
  - Replace existing globalSetup with test/integration-global-setup.ts
  - Add globalTeardown
- [ ] Keep existing database cleanup (scripts/**tests**/e2e/test-utils.ts, packages/mcp_server/src/integration-tests/setup/)
  - No changes needed - TestDatabaseManager already does fast cleanup
  - Existing beforeEach/afterEach hooks remain unchanged
- [ ] Update GitHub Actions workflow (.github/workflows/test.yml)
  - Remove CouchDB service container definition
  - Remove manual CouchDB wait/setup steps
  - Ensure Docker is available (already default on ubuntu-latest)
- [ ] Automated test: Run `pnpm test:integration` and `pnpm test:e2e` successfully without external CouchDB
- [ ] User test: Fresh clone, `pnpm install && pnpm build && pnpm test:all` passes without manual setup

## Review

- [ ] Bug/cleanup items if found

## Notes

[Important findings]
