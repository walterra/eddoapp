# /briefing recap command

**Status:** In Progress
**Created:** 2025-10-08T17:29:02
**Started:** 2025-10-08T17:29:02
**Agent PID:** 73299

## Original Todo

we need a `/briefing recap` command that provides a motivational summary of what's been accomplished today. it should check all items that have been completed today. it could also give a brief outlook for the next day.

## Description

Add a `/briefing recap` subcommand to the Telegram bot that provides users with a motivational summary of their daily accomplishments. The command will:

1. **Extend the MCP `listTodos` tool** to support filtering by completion date range (not just due date)
   - Add `completedFrom` and `completedTo` parameters
   - Query todos where `completed` timestamp falls within the specified range
   - Add missing database index that existing code references

2. **Implement the `/briefing recap` subcommand** in the Telegram bot
   - Add new case to the briefing command handler
   - Use the AI agent (similar to `/briefing now`) to orchestrate the recap
   - Create a dedicated prompt constant (`DAILY_RECAP_REQUEST_MESSAGE`)

3. **Agent generates motivational summary** that includes:
   - Specific accomplished todos (with titles, not just counts)
   - Context-aware grouping (work vs. personal tasks)
   - Celebratory/motivational tone
   - Brief outlook for tomorrow (upcoming `gtd:next` tasks)

The implementation follows the existing `/briefing now` pattern but focuses on completed items rather than upcoming tasks.

## Success Criteria

- [ ] MCP tool: `listTodos` accepts `completedFrom` and `completedTo` ISO date parameters to filter by completion timestamp
- [ ] MCP tool: Queries todos completed today using the extended parameters return only todos with `completed` timestamp in range
- [ ] Telegram command: `/briefing recap` responds with a motivational summary of today's completed todos
- [ ] Agent output: Summary includes specific todo titles (not just counts) grouped by context
- [ ] Agent output: Includes brief outlook showing upcoming actionable tasks for tomorrow
- [ ] Automated test: MCP tool integration test verifies completion date filtering works correctly
- [ ] User validation: Send `/briefing recap` in Telegram and verify it shows today's completed todos with motivational message

## Implementation Plan

### Database & Core

- [ ] Add missing index `version-context-completed-due-index` to database-structures.ts (packages/core-shared/src/api/database-structures.ts:86-102)
- [ ] Add `completedFrom` and `completedTo` parameters to listTodos tool schema (packages/mcp_server/src/mcp-server.ts:298-327)
- [ ] Add completion date range selector logic to listTodos (packages/mcp_server/src/mcp-server.ts:337-360)
- [ ] Update index selection logic to handle completion date filters (packages/mcp_server/src/mcp-server.ts:369-380)
- [ ] Update listTodos tool description to document new parameters (packages/mcp_server/src/mcp-server.ts:278-297)

### Telegram Bot

- [ ] Add RECAP_CONTENT_MARKER constant (packages/telegram_bot/src/constants/briefing.ts)
- [ ] Add DAILY_RECAP_REQUEST_MESSAGE constant (packages/telegram_bot/src/constants/briefing.ts)
- [ ] Add 'recap' case to handleBriefing switch statement (packages/telegram_bot/src/bot/commands/briefing.ts:~73)
- [ ] Create generateBriefingRecap() helper function (packages/telegram_bot/src/bot/commands/briefing.ts)
- [ ] Update briefing help text to include '/briefing recap' (packages/telegram_bot/src/bot/commands/briefing.ts:~75-83)

### Tests

- [ ] Automated test: Add integration test for completedFrom/completedTo filtering (packages/mcp_server/src/integration-tests/suites/filtering-queries.test.ts)
- [ ] Automated test: Verify completion date range queries work with existing indexes
- [ ] Automated test: Test edge cases (no completed todos, invalid date ranges)
- [ ] User test: Start Telegram bot and send `/briefing recap` command
- [ ] User test: Complete some todos today and verify `/briefing recap` shows them
- [ ] User test: Verify recap includes motivational summary and outlook for tomorrow

## Review

## Notes
