# Telegram Bot Integration Tests

These integration tests verify the complete agent loop workflow with real MCP server and CouchDB integration.

## Prerequisites

1. **MCP server must be running** on `http://localhost:3001/mcp` (or port 3002 if using proxy)

   ```bash
   pnpm dev:server
   ```

2. **CouchDB** must be accessible and configured

3. **Valid Anthropic API key** is required (tests make real API calls)
   ```bash
   export ANTHROPIC_API_KEY="your-api-key"
   ```

## Running Tests

### From telegram-bot package:

```bash
cd packages/telegram-bot
pnpm test:integration
```

### From repository root:

```bash
# Run with automatic server startup (finds available port)
pnpm test:integration:agent-loop

# Run assuming server is already running on specific port
MCP_TEST_URL=http://localhost:3001/mcp pnpm --filter @eddo/telegram-bot test:integration

# Run with custom port
MCP_TEST_PORT=3005 pnpm test:integration:agent-loop
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for real Claude API calls
- `MCP_SERVER_URL`: MCP server URL (default: `http://localhost:3001/mcp`)
- `MCP_TEST_URL`: Override MCP URL for tests
- `MCP_TEST_PORT`: Port for test server (default: 3003)
- `LLM_MODEL`: Model to use (default: `claude-3-5-haiku-20241022`)

## Test Structure

- `suites/agent-loop.test.ts`: Main agent loop E2E tests
- `helpers/agent-assertions.ts`: Custom assertions for agent behavior
- `setup/test-agent-server.ts`: Test harness for agent testing

## Notes

- Tests create isolated databases using unique API keys
- Each test uses a separate user ID to prevent conflicts
- Tests verify both agent behavior and database state
- Timeouts are set to 60 seconds to accommodate LLM response times

## CI Considerations

Due to the requirement for a valid Anthropic API key, these tests are excluded from the default `test:ci` command. To run all tests including telegram-bot integration tests in CI:

1. Set `ANTHROPIC_API_KEY` environment variable
2. Use `pnpm test:ci:all` instead of `pnpm test:ci`
