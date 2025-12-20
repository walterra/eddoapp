# Filter state not persisted

**Status:** Done
**Created:** 2025-12-20-17-32-43
**Started:** 2025-12-20-21:57:50
**Agent PID:** 98482

## Description

**What we're building:**
Add persistence for todo filter states (tags, contexts, status, time range, current date) so they survive page reloads and sync across tabs/devices. Currently, all filter selections are lost on reload, forcing users to reconfigure filters every session.

**Current State:**

- Filter state lives in eddo.tsx useState (currentDate, selectedTags, selectedContexts, selectedStatus, selectedTimeRange)
- viewMode and tableColumns already persist via useViewPreferences → user registry
- No persistence for other filter states

**Success Criteria:**

1. Filter selections (tags, contexts, status, time range, date) persist across page reloads
2. Filters sync across multiple browser tabs in real-time
3. Existing tests pass and new tests verify persistence
4. Default filter values when user has no saved preferences

## Implementation Plan

### Backend Changes

- [x] Add filter fields to UserPreferences interface (packages/core-shared/src/versions/user_registry_alpha2.ts:7-18)
  - Add: selectedTags?: string[]
  - Add: selectedContexts?: string[]
  - Add: selectedStatus?: 'all' | 'completed' | 'incomplete'
  - Add: selectedTimeRange?: { type: string; startDate?: string; endDate?: string }
  - Add: currentDate?: string (ISO string)
- [x] Update createDefaultUserPreferences with filter defaults (packages/core-shared/src/versions/user_registry_alpha2.ts:37-47)
- [x] Add filter fields to Zod validation schema (packages/web-api/src/routes/users.ts:26-36)
- [x] Add filter fields to TypeScript interface in use_profile.ts (packages/web-client/src/hooks/use_profile.ts:3-18)

### Frontend Changes

- [x] Create useFilterPreferences hook (new file: packages/web-client/src/hooks/use_filter_preferences.ts)
  - Similar pattern to useViewPreferences
  - Methods: setSelectedTags, setSelectedContexts, setSelectedStatus, setSelectedTimeRange, setCurrentDate
  - Return current values from profile.preferences with defaults
- [x] Update eddo.tsx to use persisted filter state (packages/web-client/src/eddo.tsx:58-66)
  - Replace useState with useFilterPreferences hook
  - Keep setState functions for immediate UI updates
  - Ensure preference updates are async (don't block UI)

### Testing

- [x] Unit test: useFilterPreferences hook returns correct defaults
- [x] Unit test: useFilterPreferences updates preferences via API
- [x] Integration test: Filter state persists across hook re-renders
- [x] User test: Set filters, reload page, verify filters restored
- [ ] User test: Set filters in tab 1, open tab 2, verify filters sync (BLOCKED: requires user_registry PouchDB sync from todo #1)

## Review

- [x] Code review completed
- [x] Edge case found: Invalid date string handling in useFilterPreferences
  - Issue: new Date(invalidString) returns Invalid Date object
  - Fix: Add date validation with fallback to new Date()
- [x] Fix applied and tested

## Notes

**Key Findings:**

- User preferences already stored in CouchDB user_registry database
- Preference updates via REST API: PUT /api/users/preferences
- React Query handles caching and invalidation
- useViewPreferences provides good pattern to follow
- TimeRange type exported from time_range_filter.tsx
- CompletionStatus type exported from status_filter.tsx

**Implementation Notes:**

- All backend changes (UserPreferences interface, defaults, Zod validation) complete
- Created useFilterPreferences hook following useViewPreferences pattern
- Updated eddo.tsx to use hook with async wrapper functions for UI responsiveness
- All unit tests pass (10 tests for useFilterPreferences including invalid date edge case)
- Full test suite passes (430 tests)
- Lint and format checks pass
- TypeScript compilation successful
- Edge case fixed: Invalid date strings now fallback to current date instead of Invalid Date object

**Multi-Tab Sync Status:**

- Filter preferences persist via REST API and React Query cache
- Page reload correctly restores all filter state ✅
- Multi-tab real-time sync NOT YET implemented - requires PouchDB sync for user_registry database
- This is addressed in todo #1: "Add PouchDB sync for user_registry database"
- Once user_registry has PouchDB sync, multi-tab sync will work automatically via React Query cache invalidation
