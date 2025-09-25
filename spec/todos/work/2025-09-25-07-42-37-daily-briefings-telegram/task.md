# daily briefings via telegram-bot (cron-like)

**Status:** In Progress
**Created:** 2025-09-25T07:42:37Z
**Started:** 2025-09-25T07:43:15Z
**Agent PID:** 57223

## Description

Implement a daily briefing system for the telegram-bot that sends opt-in users personalized morning summaries at 7 AM. The system includes:

- **Scheduler**: Simple interval-based scheduler checking every minute for 7 AM delivery
- **User Preferences**: Opt-in system for users to enable/disable daily briefings via telegram commands and web UI
- **Standard Briefing Format**: Comprehensive GTD-focused report including:
  - Today's due tasks and calendar appointments
  - Overdue items requiring attention
  - Next actions ready to work
  - Active time tracking sessions and yesterday's summary
  - Items waiting for others
  - Context-based task priorities

The implementation follows the project's functional patterns and integrates with existing MCP tools for data access.

## Success Criteria

- [ ] **Functional**: 7 AM scheduler triggers daily briefings for opted-in users
- [ ] **Functional**: `/briefing on` and `/briefing off` telegram commands work
- [ ] **Functional**: Daily briefing preference toggleable in web UI user settings
- [ ] **Functional**: Briefing includes due tasks, overdue items, next actions, and time tracking summary
- [ ] **Quality**: TypeScript, lint, and tests pass (`pnpm tsc:check`, `pnpm lint`, `pnpm test`)
- [ ] **User validation**: Manual test confirms 7 AM delivery, telegram commands, and web UI toggle

## Implementation Plan

- [x] Create user registry alpha2 schema with preferences field (packages/core-shared/src/versions/user_registry_alpha2.ts)
- [x] Add user registry migration function (packages/core-shared/src/versions/migrate_user_registry.ts)
- [x] Update user registry API operations (packages/core-server/src/api/user-registry.ts)
- [x] Add preferences API endpoints (packages/web-api/src/routes/users.ts)
- [x] Update user lookup for telegram bot (packages/telegram_bot/src/utils/user-lookup.ts)
- [ ] Add preferences tab to web UI profile component (packages/web-client/src/components/user_profile.tsx)
- [ ] Update profile hook with preferences methods (packages/web-client/src/hooks/use_profile.ts)
- [ ] Create daily briefing scheduler (packages/telegram_bot/src/scheduler/daily-briefing.ts)
- [ ] Add briefing toggle telegram commands (packages/telegram_bot/src/bot/commands/briefing.ts)
- [ ] Initialize scheduler in bot startup (packages/telegram_bot/src/index.ts)
- [ ] Test user registry alpha2 migration
- [ ] Test preferences API endpoints
- [ ] Test scheduler timing logic
- [ ] Test briefing generation with sample data
- [ ] Test telegram commands for briefing toggle
- [ ] Test web UI preferences toggle works
- [ ] Test `/briefing on` and `/briefing off` telegram commands
- [ ] Test 7 AM briefing delivery (simulate time change)
- [ ] Verify briefing content accuracy with sample todos

## Review

## Notes