# MCP Integration Testing Best Practices & Implementation Guide

This document outlines the 2025 best practices for integration testing MCP (Model Context Protocol) servers and provides implementation guidance for our todo/time-tracking application.

## Overview

Our MCP server exposes 8 main tools for CRUD operations, time tracking, and analytics. Integration tests ensure these tools work correctly together and handle edge cases properly.

## 2025 Best Practices Summary

### 1. Component Testing Over E2E Testing
- **Principle**: Write 3-10 focused integration tests rather than extensive E2E suites
- **Rationale**: Component tests catch 99% of bugs; integration tests focus on configuration issues, service misunderstandings, and infrastructure problems
- **Application**: Test MCP tool interactions and data flow rather than full application workflows

### 2. Transport Layer Testing
- **STDIO Transport**: Best for local development and CI/CD
- **HTTP Transport**: For production-like testing scenarios
- **Streamable HTTP**: For stateful session testing

### 3. Type Safety & Contract Testing
- **Shared Schemas**: Use TypeScript types between client/server
- **API Contract Testing**: Validate tool schemas and argument structures
- **Compile-time Validation**: Catch breaking changes early

### 4. Test Data Organization
- **Context Data**: Shared test fixtures (per file)
- **Test Records**: Explicit data per test
- **Isolation**: Each test creates/destroys its own data

### 5. Mock Strategy
- **Minimal Mocking**: Test against real MCP server when possible
- **Type-safe Mocks**: Use TypeScript `satisfy` keyword for mock definitions
- **Hybrid Approach**: Option to toggle between mocks and real server

## Current Implementation Analysis

### Existing Assets
- `scripts/test-mcp.js`: CLI-based MCP tool testing
- `dev/MCP-CRUD.md`: Comprehensive command reference
- Established test patterns in `packages/shared/src/api/`

### Available MCP Tools
1. **CREATE**: `createTodo`
2. **READ**: `listTodos`, `getActiveTimeTracking`, `getServerInfo`
3. **UPDATE**: `updateTodo`, `toggleTodoCompletion`
4. **DELETE**: `deleteTodo`
5. **TIME TRACKING**: `startTimeTracking`, `stopTimeTracking`

## Recommended Integration Test Structure

### Test Suite Organization
```
packages/server/src/integration-tests/
├── __fixtures__/           # Shared test data
├── helpers/               # Test utilities
├── suites/
│   ├── crud-lifecycle.test.ts
│   ├── time-tracking.test.ts
│   ├── filtering-queries.test.ts
│   ├── error-handling.test.ts
│   └── analytics.test.ts
└── setup/
    ├── test-server.ts     # MCP server test harness
    └── test-client.ts     # Reusable MCP client
```

### Core Test Categories

#### 1. CRUD Lifecycle Tests
```typescript
describe('MCP CRUD Lifecycle Integration', () => {
  it('should complete full create → read → update → delete cycle')
  it('should handle todo completion with repeat logic')
  it('should maintain data consistency across operations')
  it('should validate required fields and constraints')
});
```

#### 2. Time Tracking Integration Tests
```typescript
describe('MCP Time Tracking Integration', () => {
  it('should start/stop time tracking for single todo')
  it('should handle multiple concurrent tracking categories')
  it('should query active sessions correctly')
  it('should prevent invalid time tracking states')
});
```

#### 3. Query & Filtering Tests
```typescript
describe('MCP Query Operations Integration', () => {
  it('should filter by context with proper results')
  it('should filter by completion status')
  it('should handle date range queries')
  it('should respect limit and pagination')
  it('should combine multiple filters correctly')
});
```

#### 4. Error Handling & Edge Cases
```typescript
describe('MCP Error Handling Integration', () => {
  it('should reject malformed todo IDs')
  it('should validate schema compliance')
  it('should handle database connection issues')
  it('should provide meaningful error messages')
});
```

#### 5. Analytics & Reporting Tests
```typescript
describe('MCP Analytics Integration', () => {
  it('should provide accurate tag statistics')
  it('should return server health information')
  it('should handle different section requests')
});
```

## Implementation Recommendations

### 1. Test Server Harness
Create a dedicated MCP server instance for testing:
```typescript
// packages/server/src/integration-tests/setup/test-server.ts
export class MCPTestServer {
  private server: Server;
  private client: Client;
  
  async start(): Promise<void> {
    // Initialize with in-memory database
    // Start MCP server with STDIO transport
    // Create connected client
  }
  
  async stop(): Promise<void> {
    // Cleanup connections and resources
  }
  
  async resetData(): Promise<void> {
    // Clear test data between tests
  }
}
```

### 2. Test Data Factories
```typescript
// packages/server/src/integration-tests/__fixtures__/todo-factory.ts
export const createTestTodoData = {
  basic: () => ({ /* minimal valid todo */ }),
  withTimeTracking: () => ({ /* todo with active tracking */ }),
  completed: () => ({ /* completed todo */ }),
  withTags: (tags: string[]) => ({ /* todo with specific tags */ }),
};
```

### 3. Test Utilities
```typescript
// packages/server/src/integration-tests/helpers/mcp-assertions.ts
export const mcpAssertions = {
  async toolExists(client: Client, toolName: string): Promise<boolean>,
  async callTool(client: Client, name: string, args: any): Promise<any>,
  async expectValidTodo(todo: any): Promise<void>,
  async expectError(promise: Promise<any>, errorType: string): Promise<void>,
};
```

### 4. Automated Test Scenarios
Based on `dev/MCP-CRUD.md`, implement automated versions of manual test sequences:

```typescript
describe('MCP Complete Workflow Integration', () => {
  it('should execute full todo management workflow', async () => {
    // Automated version of the bash sequence from MCP-CRUD.md
    const todo1 = await createTodo(workTodoData);
    const todo2 = await createTodo(privateTodoData);
    
    await startTimeTracking(todo1._id, 'focus');
    await updateTodo(todo1._id, { description: 'Updated' });
    await stopTimeTracking(todo1._id, 'focus');
    
    const activeTodos = await listTodos({ completed: false });
    expect(activeTodos).toHaveLength(2);
    
    await toggleTodoCompletion(todo1._id);
    await deleteTodo(todo2._id);
    
    const finalState = await listTodos({});
    expect(finalState).toHaveLength(1);
    expect(finalState[0].completed).toBeTruthy();
  });
});
```

## Configuration & Setup

### Vitest Configuration
```typescript
// vitest.config.ts (integration tests specific)
export default defineConfig({
  test: {
    name: 'mcp-integration',
    include: ['packages/server/src/integration-tests/**/*.test.ts'],
    testTimeout: 30000, // MCP operations can be slower
    setupFiles: ['packages/server/src/integration-tests/setup/global.ts'],
  },
});
```

### Package Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "test:mcp:integration": "vitest run packages/server/src/integration-tests",
    "test:mcp:integration:watch": "vitest packages/server/src/integration-tests",
    "test:mcp:debug": "vitest --reporter=verbose packages/server/src/integration-tests"
  }
}
```

## Testing Strategy

### 1. Continuous Integration
- Run integration tests after unit tests pass
- Use in-memory database for speed
- Test against multiple Node.js versions if needed

### 2. Local Development
- Quick smoke tests with `pnpm test:mcp <tool>`
- Full integration suite with `pnpm test:mcp:integration`
- Watch mode for active development

### 3. Production Validation
- Subset of integration tests against staging environment
- Health check endpoints validation
- Performance benchmarking

## Monitoring & Observability

### Test Metrics to Track
- Tool execution times
- Database operation performance
- Memory usage during test runs
- Error rate by tool type

### Logging Strategy
- Structured logging for MCP operations
- Test execution traces
- Database query logging in test mode

## Migration Path

### Phase 1: Foundation
1. Set up test harness and basic utilities
2. Implement core CRUD lifecycle tests
3. Add error handling test cases

### Phase 2: Advanced Testing
1. Time tracking integration tests
2. Complex query and filtering tests
3. Analytics and reporting validation

### Phase 3: Optimization
1. Performance testing integration
2. Load testing for concurrent operations
3. Memory leak detection

## Next Steps

1. **Immediate**: Implement basic test harness and CRUD tests
2. **Short-term**: Add time tracking and query integration tests
3. **Medium-term**: Implement automated workflow tests from MCP-CRUD.md
4. **Long-term**: Add performance monitoring and load testing

This integration testing strategy ensures comprehensive coverage while following 2025 best practices for maintainable, reliable test suites.