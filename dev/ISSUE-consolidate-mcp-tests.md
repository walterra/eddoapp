# Issue: Consolidate MCP Server Integration Test Systems

## Problem Statement

Currently, the MCP server integration tests use two separate systems that create duplication and complexity:

1. **Custom Script** (`scripts/run-mcp-server-integration-tests.js`):
   - Port management (finds available ports)
   - Server lifecycle (spawn/kill MCP server)
   - External vitest execution
   - Output filtering and error handling

2. **Vitest Setup** (`packages/server/vitest.integration.config.ts` + `global.ts`):
   - Database setup/teardown
   - Environment configuration
   - Test isolation
   - Assumes server is already running

This dual approach creates maintenance overhead and inconsistency between local development and CI environments.

## Current Architecture Analysis

### Custom Script Responsibilities
- Dynamic port allocation (`findAvailablePort`)
- Server process management (`spawn`, `kill`)
- Environment variable setup (`MCP_TEST_PORT`, `COUCHDB_TEST_DB_NAME`)
- Test execution orchestration
- Error handling and cleanup

### Vitest Setup Responsibilities
- Database schema setup and teardown
- Test environment configuration
- Per-test isolation via API keys
- Client connection management
- Test data cleanup

## Proposed Solution

### Option 1: Vitest Global Setup (Recommended)

**Implementation:**
1. Create `src/integration-tests/setup/global-setup.ts`
2. Move server lifecycle logic from custom script into vitest global setup
3. Update vitest config to use `globalSetup` array
4. Use vitest's `provide` mechanism to share server config with tests
5. Remove custom script dependency

**Benefits:**
- Single testing system (vitest-native)
- Better integration with vitest features (watch mode, UI, etc.)
- Reduced complexity and maintenance burden
- Consistent with modern testing practices
- Proper teardown in all scenarios

### Option 2: Enhanced Custom Script

**Implementation:**
- Keep custom script but improve vitest integration
- Pass server config through environment variables
- Streamline the two-phase approach
- Better error handling between script and vitest

**Benefits:**
- Minimal changes to existing setup
- Explicit control over server lifecycle
- Clear separation of concerns

## Implementation Plan

### Phase 1: Create Vitest Global Setup
1. Create `src/integration-tests/setup/global-setup.ts` with:
   - Port finding logic
   - Server startup/shutdown
   - Environment configuration
   - Server readiness polling
2. Update `vitest.integration.config.ts` to include `globalSetup`
3. Modify `global.ts` to remove redundant server management
4. Test locally to ensure functionality

### Phase 2: Simplify Root Command
1. Update `test:integration:mcp-server` in root package.json
2. Change from custom script to direct vitest execution
3. Remove `scripts/run-mcp-server-integration-tests.js`
4. Verify CI compatibility

### Phase 3: Cleanup and Documentation
1. Remove unused port checking utilities
2. Update CLAUDE.md with new test command structure
3. Document the consolidated approach

## Technical Details

### Vitest Global Setup Structure
```typescript
// src/integration-tests/setup/global-setup.ts
export async function setup({ provide }) {
  // Port allocation
  const port = await findAvailablePort(3001);
  
  // Server startup
  const serverProcess = await startTestServer(port);
  
  // Share config with tests
  provide('testServerPort', port);
  provide('testServerUrl', `http://localhost:${port}/mcp`);
  
  // Return cleanup function
  return async () => {
    await stopTestServer(serverProcess);
  };
}
```

### Updated Vitest Config
```typescript
export default defineConfig({
  test: {
    globalSetup: ['src/integration-tests/setup/global-setup.ts'],
    // ... existing config
  }
});
```

## Migration Path

1. **Low Risk**: Implement global setup alongside existing system
2. **Test**: Verify both approaches work
3. **Switch**: Update root command to use vitest directly
4. **Cleanup**: Remove old custom script

## Expected Outcomes

- **Reduced Complexity**: Single test system instead of two
- **Better Integration**: Native vitest features work properly
- **Easier Maintenance**: Standard vitest patterns
- **Improved DX**: Better watch mode, UI, and debugging support
- **CI Consistency**: Same execution path locally and in CI

## References

- [Vitest Global Setup Documentation](https://vitest.dev/config/#globalsetup)
- [Vitest Provide/Inject for Global Setup](https://vitest.dev/guide/test-context.html#provide-inject)
- Current implementation files:
  - `scripts/run-mcp-server-integration-tests.js`
  - `packages/server/vitest.integration.config.ts`
  - `packages/server/src/integration-tests/setup/global.ts`