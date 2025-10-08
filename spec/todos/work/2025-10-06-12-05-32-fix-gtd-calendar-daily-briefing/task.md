# no gtd:calendar events showed up in my daily briefing

**Status:** In Progress
**Created:** 2025-10-06T12:05:32Z
**Started:** 2025-10-06T12:08:00Z
**Agent PID:** 73299

## Original Todo

no gtd:calendar events showed up in my daily briefing

## Description

**Problem**: Daily briefings are not showing `gtd:calendar` tagged events (appointments and meetings), even though the feature documentation promises to include "Today's due tasks and appointments."

**Root Cause**: The `DAILY_BRIEFING_REQUEST_MESSAGE` constant in `/Users/walterra/dev/eddoapp/packages/telegram_bot/src/constants/briefing.ts` does not instruct the AI agent to query for `gtd:calendar` tagged items. The prompt requests queries for:

1. Today's due todos
2. Overdue items
3. `gtd:next` tagged items
4. `gtd:waiting` tagged items
5. Active time tracking

But **it's missing** a query for `gtd:calendar` tagged items.

**What needs to happen**: Add an explicit instruction to the briefing request message to query for `gtd:calendar` tagged items, so calendar appointments are properly included in daily briefings with their time-specific formatting (e.g., "15:00 Doctor appointment").

**Context**: The `gtd:calendar` tag is used to mark time-specific appointments/meetings that must happen at a specific time (as opposed to flexible tasks). The MCP server fully supports querying by this tag, but the briefing prompt doesn't use it.

## Success Criteria

- [ ] Functional: `DAILY_BRIEFING_REQUEST_MESSAGE` includes explicit instruction to query `gtd:calendar` tagged items
- [ ] Functional: Daily briefings include calendar appointments when gtd:calendar tagged todos exist
- [ ] User validation: Create test calendar appointment and verify it appears in `/briefing now` output

## Implementation Plan

- [x] Update `DAILY_BRIEFING_REQUEST_MESSAGE` to include gtd:calendar query (packages/telegram_bot/src/constants/briefing.ts:11-12)
- [ ] Automated test: Run briefing command and verify message includes calendar query instruction
- [ ] User test: Create a gtd:calendar tagged todo for today and run `/briefing now` to verify it appears in the output
