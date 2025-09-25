# daily briefings via telegram-bot (cron-like)

**Status:** In Progress - Ready for Testing
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
- [x] **Functional**: `/briefing on` and `/briefing off` telegram commands work
- [x] **Functional**: Daily briefing preference toggleable in web UI user settings
- [x] **Functional**: Briefing includes due tasks, overdue items, next actions, and time tracking summary
- [x] **Quality**: TypeScript, lint, and tests pass (`pnpm tsc:check`, `pnpm lint`, `pnpm test`)
- [x] **User validation**: Manual test confirms telegram commands and web UI toggle work correctly

## Implementation Plan

- [x] Create user registry alpha2 schema with preferences field (packages/core-shared/src/versions/user_registry_alpha2.ts)
- [x] Add user registry migration function (packages/core-shared/src/versions/migrate_user_registry.ts)
- [x] Update user registry API operations (packages/core-server/src/api/user-registry.ts)
- [x] Add preferences API endpoints (packages/web-api/src/routes/users.ts)
- [x] Update user lookup for telegram bot (packages/telegram_bot/src/utils/user-lookup.ts)
- [x] Add preferences tab to web UI profile component (packages/web-client/src/components/user_profile.tsx)
- [x] Update profile hook with preferences methods (packages/web-client/src/hooks/use_profile.ts)
- [x] Create daily briefing scheduler (packages/telegram_bot/src/scheduler/daily-briefing.ts)
- [x] Add briefing toggle telegram commands (packages/telegram_bot/src/bot/commands/briefing.ts)
- [x] Initialize scheduler in bot startup (packages/telegram_bot/src/index.ts)
- [x] Test user registry alpha2 migration (fixed TypeScript compilation issues)
- [x] Test preferences API endpoints (✅ API calls successful, toggle visible and functional)
- [x] Test web UI preferences toggle works (✅ Toggle fixed and working, API integration confirmed)
- [x] Test telegram commands functionality (✅ `/briefing on/off/status/now` work with clear feedback)
- [x] Test briefing content generation (✅ Real briefing with actual todos, overdue items, next actions, active time tracking)
- [x] Test cross-platform sync (✅ Settings sync between web UI toggle and telegram commands)
- [x] Test quality checks (✅ TypeScript, lint, and tests all pass)
- [ ] Test 7 AM scheduler delivery (manual verification or simulation needed)

## Review

## Notes

### Progress Summary (2025-09-25T07:43:15Z)

**✅ Infrastructure Complete:**
- User registry successfully migrated from alpha1 to alpha2 with preferences support
- API endpoints for preferences implemented (`PUT /api/users/preferences`)
- Web UI preferences tab fully functional with toggle and time input
- All TypeScript compilation issues resolved
- Linting issues fixed
- Build and test infrastructure updated

**🔧 Key Implementation Details:**
- Default preferences: `dailyBriefing: false`, `briefingTime: '07:00'`
- Automatic migration from alpha1 to alpha2 maintains backward compatibility
- User preferences accessible in telegram bot via updated user lookup
- Web UI includes clear instructions for users about daily briefings

**⚠️ Important Technical Notes:**
- Fixed export issue with `createDefaultUserPreferences` in core-shared package
- Added `@eddo/core-shared` as dependency to telegram-bot package
- Updated all test files to include preferences field for alpha2 compatibility
- React props sorted alphabetically for linting compliance

**✅ Implementation Complete (2025-09-25T08:20:00Z):**

**🎯 Core Implementation:**
- Daily briefing scheduler with 7 AM delivery (configurable)
- LLM-powered briefing generation using Claude with proper system prompts
- Telegram bot commands: `/briefing`, `/briefing on`, `/briefing off`, `/briefing status`
- Seamless integration with bot startup and graceful shutdown
- Comprehensive error handling with fallback messages

**🤖 AI-Powered Briefings:**
- Replaced hardcoded text templates with Claude AI generation
- Structured data fetching: today's tasks, overdue items, next actions, waiting items, active tracking
- GTD-focused system prompt for productivity coaching tone
- Personalized briefings based on user's actual todo data
- Fallback system for when AI generation fails

**⚙️ Technical Architecture:**
- Type-safe implementation with proper TypeScript interfaces
- MCP client integration for data access
- Proper error handling and logging throughout
- Rate limiting between users to avoid Telegram API limits
- Background scheduler with configurable check intervals

**🔧 Integration Features:**
- Opt-in system working across both web UI and Telegram
- User preferences stored in alpha2 user registry with migration
- Commands provide clear feedback and help instructions
- Legacy command compatibility (`/briefing_on`, `/briefing_off`)

**🚧 Ready for Testing:**
- All implementation steps completed and TypeScript errors resolved
- Ready for user validation and manual testing
- Core functionality implemented per requirements