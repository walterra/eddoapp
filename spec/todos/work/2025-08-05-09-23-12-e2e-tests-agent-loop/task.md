# we're on the branch to implement e2e tests for the agent loop, let's continue working on that

**Status:** Refining
**Created:** 2025-08-05T09:23:12
**Agent PID:** 20118

## Original Todo

we're on the branch to implement e2e tests for the agent loop, let's continue working on that

## Description

Implement end-to-end tests for the agent loop that test the complete flow from input to final output through all real components. Currently, the agent loop has integration tests in `packages/telegram_bot/src/integration-tests/` that test with real MCP server and CouchDB. The goal is to create e2e tests in the main e2e test directory (`scripts/__tests__/e2e/`) that:

- Test the agent loop independently of the Telegram bot
- Use real Claude API calls (not mocked)
- Connect to real MCP server for tool execution
- Perform real database operations
- Verify complete workflows from natural language input to task completion

This will ensure the agent loop works correctly as a standalone component, testing the full stack of agent → Claude → MCP tools → database → response.

## Implementation Plan

### Code Changes:

- [ ] Create agent loop e2e test file (`scripts/__tests__/e2e/agent-loop.e2e.test.ts`)
- [ ] Add agent-specific test utilities (`scripts/__tests__/e2e/agent-test-utils.ts`)
- [ ] Create standalone agent runner script (`scripts/run-agent.ts`)
- [ ] Update test configuration if needed (`vitest.config.ts` - e2e project)
- [ ] Add agent e2e test command to package.json scripts

### Automated Tests:

- [ ] Automated test: Basic todo creation workflow - natural language to database
- [ ] Automated test: Complex todo with context, tags, and due dates
- [ ] Automated test: Multi-step workflow (create todo, then start timer)
- [ ] Automated test: Error handling for invalid requests
- [ ] Automated test: Multiple todos in single request
- [ ] Automated test: Todo listing and filtering
- [ ] Automated test: Todo completion workflow
- [ ] Automated test: Time tracking start/stop operations
- [ ] Automated test: Database state verification after agent operations
- [ ] Automated test: Agent cleanup and session management

### User Tests:

- [ ] User test: Run `pnpm test:e2e:agent-loop` and verify all tests pass
- [ ] User test: Check that tests use real Claude API (verify API calls in logs)
- [ ] User test: Verify test databases are created and cleaned up properly
- [ ] User test: Run tests in CI mode with `CI=true pnpm test:e2e:agent-loop`
- [ ] User test: Verify agent loop works independently without Telegram dependencies