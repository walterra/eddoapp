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

- [x] Add missing index `version-context-completed-due-index` to database-structures.ts (packages/core-shared/src/api/database-structures.ts:86-102)
- [x] Add `completedFrom` and `completedTo` parameters to listTodos tool schema (packages/mcp_server/src/mcp-server.ts:298-327)
- [x] Add completion date range selector logic to listTodos (packages/mcp_server/src/mcp-server.ts:337-360)
- [x] Update index selection logic to handle completion date filters (packages/mcp_server/src/mcp-server.ts:369-380)
- [x] Update listTodos tool description to document new parameters (packages/mcp_server/src/mcp-server.ts:278-297)

### Telegram Bot - Command

- [x] Add RECAP_CONTENT_MARKER constant (packages/telegram_bot/src/constants/briefing.ts)
- [x] Add DAILY_RECAP_REQUEST_MESSAGE constant (packages/telegram_bot/src/constants/briefing.ts)
- [x] Add 'recap' case to handleBriefing switch statement (packages/telegram_bot/src/bot/commands/briefing.ts:74)
- [x] Create generateBriefingRecap() helper function (packages/telegram_bot/src/bot/commands/briefing.ts:270-308)
- [x] Update briefing help text to include '/briefing recap' (packages/telegram_bot/src/bot/commands/briefing.ts:80-87)

### Telegram Bot - Agent Integration

- [x] Import RECAP_CONTENT_MARKER in simple-agent.ts (packages/telegram_bot/src/agent/simple-agent.ts:6-9)
- [x] Add marker stripping logic for recaps (packages/telegram_bot/src/agent/simple-agent.ts:241-262)
- [x] Add printing support for recaps (packages/telegram_bot/src/agent/simple-agent.ts:290-366)
- [x] Update logging to include recap marker detection (packages/telegram_bot/src/agent/simple-agent.ts:273-281)

### Telegram Bot - Scheduler

- [x] Add recap preferences to UserPreferences interface (packages/core-shared/src/versions/user_registry_alpha2.ts:11-13)
- [x] Update createDefaultUserPreferences with recap defaults (packages/core-shared/src/versions/user_registry_alpha2.ts:39-41)
- [x] Import recap constants in scheduler (packages/telegram_bot/src/scheduler/daily-briefing.ts:9-10)
- [x] Add sentRecapsToday Set to track sent recaps (packages/telegram_bot/src/scheduler/daily-briefing.ts:23)
- [x] Reset recaps tracker on new day (packages/telegram_bot/src/scheduler/daily-briefing.ts:77)
- [x] Add checkAndSendUserRecaps method (packages/telegram_bot/src/scheduler/daily-briefing.ts:368-401)
- [x] Add checkUserRecapTime method (packages/telegram_bot/src/scheduler/daily-briefing.ts:406-449)
- [x] Add sendRecapToUser method (packages/telegram_bot/src/scheduler/daily-briefing.ts:454-548)
- [x] Update getStatus to include sentRecapsToday (packages/telegram_bot/src/scheduler/daily-briefing.ts:553-567)

### Web UI - User Preferences

- [x] Add recap state variables to user_profile.tsx (packages/web-client/src/components/user_profile.tsx:42-44)
- [x] Initialize recap preferences from profile (packages/web-client/src/components/user_profile.tsx:54-56)
- [x] Add recap preferences to save handler (packages/web-client/src/components/user_profile.tsx:219-221)
- [x] Add Daily Recaps UI section with toggles and time input (packages/web-client/src/components/user_profile.tsx:706-763)
- [x] Update TypeScript interface in use_profile hook (packages/web-client/src/hooks/use_profile.ts:9-11,42-44)
- [x] Update API validation schema to accept recap fields (packages/web-api/src/routes/users.ts:43-48)
- [x] Fix user registration to include recap defaults (packages/web-api/src/routes/auth.ts:100-101)

### Tests

- [x] Automated test: Add integration test for completedFrom/completedTo filtering (packages/mcp_server/src/integration-tests/suites/filtering-queries.test.ts:181-295)
- [x] Automated test: Verify completion date range queries work with existing indexes
- [x] Automated test: Test edge cases (no completed todos, invalid date ranges)
- [x] Fix test fixtures: Update user preferences in global-test-user.ts (packages/mcp_server/src/integration-tests/setup/global-test-user.ts:107-108)
- [x] Fix test fixtures: Update user preferences in global.ts (packages/mcp_server/src/integration-tests/setup/global.ts:138-139)
- [x] Fix test fixtures: Update auth middleware tests (packages/telegram_bot/src/bot/middleware/auth.test.ts:146-147,358-359)
- [x] Automated test: TypeScript compilation check passes
- [x] Automated test: Lint check passes
- [ ] User test: Start Telegram bot and send `/briefing recap` command
- [ ] User test: Complete some todos today and verify `/briefing recap` shows them
- [ ] User test: Verify recap includes motivational summary and outlook for tomorrow
- [x] User test: Open web UI preferences, verify recap section displays correctly
- [x] User test: Toggle recap preferences and verify they save correctly

## Review

## Notes

### Prompt Engineering Iterations

The DAILY_RECAP_REQUEST_MESSAGE went through several iterations to prevent hallucination:

1. Initial version: Agent hallucinated recaps before calling MCP tools
2. Added "DO NOT respond until..." - Still hallucinated
3. Two-message structure with explicit marker placement instructions
   - First message: Brief acknowledgment only (under 10 words), NO marker
   - Second message: Actual recap with marker at the beginning
4. Improved formatting with clear section headers and bullet points
   - Added **FIRST MESSAGE (NO MARKER):** and **SECOND MESSAGE (WITH MARKER):** headers
   - Restructured as bulleted lists for better readability
   - Added CRITICAL reminder at the end emphasizing marker placement
   - Fixed issue where marker was appearing in first message instead of second

### Scheduler Architecture

The scheduler follows the existing briefing pattern:

- Checks every minute for users whose recap time has arrived
- Default recap time: 18:00 (configurable per user)
- Tracks sent recaps per day to avoid duplicates
- Supports thermal printing if user enables `printRecap` preference
- Uses the same agent infrastructure as briefings
