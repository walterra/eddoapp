# Telegram Bot Integration Tests

These integration tests verify the complete agent loop workflow with real MCP server and CouchDB integration.

## Prerequisites

1. **MCP server must be running** on `http://localhost:3001/mcp` (or port 3002 if using proxy)

   ```bash
   pnpm dev:server
   ```

2. **CouchDB** must be accessible and configured

3. **Valid provider credentials** are required (tests make real API calls)

   ```bash
   # Anthropic
   export ANTHROPIC_API_KEY="your-api-key"
   # or
   export ANTHROPIC_OAUTH_TOKEN="your-oauth-token"

   # OpenAI
   export OPENAI_API_KEY="your-api-key"
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

- `ANTHROPIC_API_KEY`: Anthropic API key (pi-ai convention)
- `ANTHROPIC_OAUTH_TOKEN`: Anthropic OAuth token (preferred when available)
- `MCP_SERVER_URL`: MCP server URL (default: `http://localhost:3001/mcp`)
- `MCP_TEST_URL`: Override MCP URL for tests
- `MCP_TEST_PORT`: Port for test server (default: 3003)
- `LLM_MODEL`: Model to use (default: `claude-sonnet-4-5-20250929`, example: `openai/gpt-5.2`)
- `LLM_MAX_TOKENS`: Maximum output tokens for pi-ai calls (default: 4096)
- `LLM_REASONING_EFFORT`: Reasoning effort for reasoning models (default: `low`)

## Model-specific VCR recordings

Cassettes are stored under a model-specific directory. `VCR_MODE=record` overwrites only that model's cassette set.

```bash
OPENAI_API_KEY="sk-..." \
LLM_MODEL="openai/gpt-5.2" \
VCR_MODE=record \
pnpm test:integration:agent-loop
```

This writes OpenAI recordings under `cassettes/openai_gpt-5_2/`.

Playback discovers all model cassette directories and runs the suite once per recorded model:

```bash
pnpm test:integration:agent-loop:playback
```

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

Due to the requirement for valid Anthropic credentials, these tests are excluded from the default `test:ci` command. To run all tests including telegram-bot integration tests in CI:

1. Set `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN`
2. Use `pnpm test:ci:all` instead of `pnpm test:ci`
