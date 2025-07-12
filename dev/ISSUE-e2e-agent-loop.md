# E2E Tests for Agent Loop

## Overview
Create end-to-end tests for the `SimpleAgent` class in `packages/telegram-bot/src/agent/simple-agent.ts` that test the complete agent loop workflow without Telegram integration.

## Test Structure
1. **Test File**: `packages/telegram-bot/src/agent/simple-agent.test.ts`
2. **Test Setup**: Mock Telegram context, real MCP server integration, real CouchDB
3. **Test Flow**: Input message → Agent processes → Verify todo created in CouchDB

## Key Components to Test

### 1. Agent Loop Integration
- Test the complete `agentLoop` method
- Verify LLM calls with system prompt containing MCP tools
- Test tool parsing and execution
- Validate multi-iteration scenarios

### 2. MCP Integration
- Real MCP server connection (not mocked)
- Test tool discovery and invocation
- Verify database operations through MCP

### 3. Test Cases
- **Basic todo creation**: "add todo next friday to go shopping"
- **Complex todo**: "create work todo for quarterly report due next month with high priority tag"
- **Todo with time tracking**: "add todo to review code and start tracking time"
- **Error handling**: Invalid inputs, MCP failures

## Test Infrastructure

### 1. Mock Telegram Context
```typescript
const mockTelegramContext = {
  reply: vi.fn(),
  replyWithChatAction: vi.fn(),
  // Other BotContext methods as needed
}
```

### 2. Database Setup
- Use test CouchDB instance
- Unique database per test (API key isolation)
- Clean up after each test

### 3. MCP Server Setup
- Start real MCP server in test mode
- Use test database configuration
- Proper cleanup after tests

## Test Scenarios

### 1. Simple Todo Creation
```typescript
it('should create todo from natural language input', async () => {
  const input = "add todo next friday to go shopping";
  const result = await agent.execute(input, 'test-user', mockContext);
  
  expect(result.success).toBe(true);
  // Verify todo exists in CouchDB
  const todos = await db.find({ selector: { title: { $regex: /shopping/ } } });
  expect(todos.docs).toHaveLength(1);
  expect(todos.docs[0].due).toMatch(/friday/); // Date parsing
});
```

### 2. Complex Todo with Context
```typescript
it('should create work todo with context and tags', async () => {
  const input = "create work todo for quarterly report due next month with urgent tag";
  const result = await agent.execute(input, 'test-user', mockContext);
  
  expect(result.success).toBe(true);
  const todos = await db.find({ selector: { context: 'work' } });
  expect(todos.docs[0].tags).toContain('urgent');
});
```

### 3. Multi-iteration Processing
```typescript
it('should handle complex requests requiring multiple tool calls', async () => {
  const input = "create todo, then list all my todos";
  const result = await agent.execute(input, 'test-user', mockContext);
  
  expect(result.success).toBe(true);
  // Verify both creation and listing occurred
  expect(mockContext.reply).toHaveBeenCalledWith(
    expect.stringContaining('Tool createTodo')
  );
  expect(mockContext.reply).toHaveBeenCalledWith(
    expect.stringContaining('Tool listTodos')
  );
});
```

## Files to Create
1. `packages/telegram-bot/src/agent/simple-agent.test.ts` - Main test file
2. `packages/telegram-bot/src/agent/__fixtures__/mock-telegram-context.ts` - Mock helpers
3. Updates to `packages/telegram-bot/vitest.config.ts` - Test configuration

## Mock Strategy
- **Mock**: Telegram-specific functionality (reply, typing indicators)
- **Real**: MCP server, CouchDB, Claude API calls
- **Isolated**: Each test gets unique database via API key

This approach tests the actual agent loop logic and MCP integration while isolating from Telegram infrastructure.

## Implementation Notes
- Tests will be in the `telegram-bot` package but focus specifically on agent loop functionality
- Use real MCP server and CouchDB for authentic integration testing
- Mock only the Telegram-specific parts that aren't relevant to agent logic
- Each test should verify end-to-end flow: input → agent processing → database state