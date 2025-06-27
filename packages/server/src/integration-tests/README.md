# MCP Integration Tests

Comprehensive integration test suite for the MCP (Model Context Protocol) server, following 2025 best practices and testing all CRUD operations, time tracking, and analytics functionality.

## Overview

This test suite validates the complete MCP server functionality through real client-server interactions, ensuring all tools work correctly both individually and in complex workflows.

## Test Structure

```
packages/server/src/integration-tests/
├── __fixtures__/           # Test data factories and fixtures
├── helpers/               # Custom assertions and utilities
├── suites/               # Test suites organized by functionality
├── setup/                # Test configuration and global setup
└── README.md             # This file
```

## Test Suites

### 1. CRUD Lifecycle Tests (`crud-lifecycle.test.ts`)
- Complete create → read → update → delete workflows
- Todo completion toggling and repeat functionality
- Batch operations and data consistency validation
- Error handling for invalid inputs and operations

### 2. Time Tracking Tests (`time-tracking.test.ts`)
- Start/stop time tracking for single and multiple categories
- Active time tracking queries and filtering
- Edge cases and error recovery
- Time tracking data integrity across operations

### 3. Filtering and Query Tests (`filtering-queries.test.ts`)
- Context-based filtering
- Completion status filtering
- Date range queries
- Complex multi-filter combinations
- Limit and pagination functionality

### 4. Analytics Tests (`analytics.test.ts`)
- Server information queries
- Tag statistics accuracy and updates
- Performance with large datasets
- Real-world analytics scenarios

### 5. Complete Workflow Tests (`workflow-integration.test.ts`)
- End-to-end workflows based on MCP-CRUD.md
- Multi-user simulation scenarios
- Project management workflows
- Error recovery and system consistency

## Running Tests

### Prerequisites
1. MCP server running on `http://localhost:3002/mcp`
2. CouchDB accessible and configured
3. Node.js 18+ and pnpm installed

### Commands

```bash
# Run all integration tests
pnpm test:mcp:integration

# Watch mode for development
pnpm test:mcp:integration:watch

# Run specific test suite
pnpm test:mcp:integration --run suites/crud-lifecycle.test.ts

# Run with UI (if vitest UI installed)
pnpm test:mcp:integration:ui
```

### From Root Directory

```bash
# Run integration tests from root
pnpm test:mcp:integration

# Watch integration tests from root
pnpm test:mcp:integration:watch
```

## Test Configuration

### Environment Variables
- `MCP_TEST_URL`: MCP server URL (default: `http://localhost:3002/mcp`)
- `NODE_ENV`: Set to `test` automatically

### Timeouts
- Test timeout: 30 seconds
- Hook timeout: 10 seconds
- Connection timeout: 30 seconds

### Test Isolation
- Each test suite runs with fresh data
- Tests run sequentially to avoid database conflicts
- Automatic cleanup after each test

## Test Architecture

### Test Server Harness (`setup/test-server.ts`)
Provides a reusable MCP client connection for tests:
- Automatic connection management
- Server health checking
- Test data reset functionality
- Tool discovery and invocation

### Custom Assertions (`helpers/mcp-assertions.ts`)
Domain-specific assertions for MCP testing:
- Todo structure validation
- Filtering result verification
- Time tracking state checks
- Server info and analytics validation

### Test Data Factories (`__fixtures__/todo-factory.ts`)
Consistent test data generation:
- Basic todo templates
- Complex todos with all fields
- Batch todo generation
- Invalid data for error testing

## Writing New Tests

### Basic Test Structure
```typescript
import { describe, it, beforeEach, afterEach } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';

describe('New Test Suite', () => {
  let testServer: MCPTestServer;
  let assert: ReturnType<typeof createMCPAssertions>;

  beforeEach(async () => {
    testServer = new MCPTestServer();
    await testServer.waitForServer();
    assert = createMCPAssertions(testServer);
    await testServer.resetTestData();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  it('should test something', async () => {
    // Test implementation
  });
});
```

### Best Practices
1. **Use meaningful test names** that describe the expected behavior
2. **Test both happy path and error cases** for comprehensive coverage
3. **Use custom assertions** for domain-specific validations
4. **Clean up test data** in each test to ensure isolation
5. **Test realistic workflows** that mirror actual usage patterns

## Debugging Tests

### Common Issues
1. **Connection timeouts**: Ensure MCP server is running and accessible
2. **Database conflicts**: Tests may interfere if run in parallel
3. **Test data pollution**: Use `resetTestData()` to clean up between tests

### Debug Strategies
1. **Run single test**: Use `--run suites/specific.test.ts` to isolate issues
2. **Enable verbose output**: Tests use verbose reporter by default
3. **Check server logs**: Monitor MCP server output during test runs
4. **Use watch mode**: Automatically re-run tests on file changes

## Performance Considerations

### Test Execution Time
- Individual tests: < 5 seconds
- Full suite: < 5 minutes
- Database operations are the primary bottleneck

### Optimization Strategies
1. **Sequential execution** prevents database conflicts
2. **Efficient cleanup** using bulk delete operations
3. **Connection reuse** within test suites
4. **Minimal test data** creation for faster setup

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run MCP Integration Tests
  run: |
    # Start MCP server
    pnpm dev:server &
    
    # Wait for server to be ready
    sleep 10
    
    # Run integration tests
    pnpm test:mcp:integration
    
    # Cleanup
    pkill -f mcp-server
```

## Maintenance

### Regular Tasks
1. **Update test data** when schema changes
2. **Add tests for new features** as they're implemented
3. **Review test performance** and optimize slow tests
4. **Update documentation** when test structure changes

### Schema Evolution
When the todo schema changes:
1. Update `TodoAlpha3` interface in `mcp-assertions.ts`
2. Update test data factories in `todo-factory.ts`
3. Update validation assertions as needed
4. Run full test suite to identify breaking changes

## Contributing

1. Follow existing test patterns and naming conventions
2. Add tests for all new MCP tools and functionality
3. Ensure tests pass both locally and in CI
4. Update documentation for significant changes
5. Use descriptive commit messages following CC conventions