# in todo_board.tsx use tanstack query for fetchTimeTrackingActive similar with todo and activities.

**Status:** In Progress
**Created:** 2025-10-05T16:56:36
**Started:** 2025-10-05T16:58:00
**Agent PID:** 81503

## Original Todo

in todo_board.tsx use tanstack query for fetchTimeTrackingActive similar with todo and activities.

## Description

**Current State:**

- `todo_board.tsx` currently uses a manual `fetchTimeTrackingActive` function with `useCallback` and local state
- It fetches active time tracking IDs once on initialization using a direct PouchDB query
- This data won't automatically update when database changes occur

**Desired State:**

- Migrate `fetchTimeTrackingActive` to use TanStack Query pattern, matching the existing `useTodosByWeek` and `useActivitiesByWeek` hooks
- Create a new `useTimeTrackingActive` hook following the established pattern
- Replace manual state management with TanStack Query's caching and automatic invalidation
- Ensure real-time updates through the existing PouchDB changes feed integration

**Benefits:**

- Consistency with existing query patterns in the codebase
- Automatic cache invalidation when todos change (already handled by `DatabaseChangesProvider`)
- Built-in loading and error states from TanStack Query
- Better developer experience with unified data fetching approach

## Success Criteria

- [ ] Functional: New `useTimeTrackingActive` hook returns same data structure as current implementation (array of todo IDs)
- [ ] Functional: Active time tracking IDs automatically update when todos change (via existing PouchDB changes feed)
- [ ] Functional: Time tracking highlights in UI work identically to current behavior
- [ ] Code quality: Hook follows same pattern as `useTodosByWeek` and `useActivitiesByWeek` (query key structure, enabled parameter, performance timing)
- [ ] Code quality: All manual state management removed from `todo_board.tsx` (no `useState` for `timeTrackingActive`, no `useCallback` for fetch function)
- [ ] User validation: Manual test confirms time tracking highlights update in real-time when starting/stopping time tracking on a todo

## Implementation Plan

### Code Modifications

- [x] Create new hook file `packages/web-client/src/hooks/use_time_tracking_active.ts` with TanStack Query pattern (packages/web-client/src/hooks/use_time_tracking_active.ts)
- [x] Update `packages/web-client/src/components/todo_board.tsx` to: (packages/web-client/src/components/todo_board.tsx:16,60-72,331-333)
  - Import and use `useTimeTrackingActive` hook
  - Replace `timeTrackingActive` state with query result
  - Remove `fetchTimeTrackingActive` callback function
  - Remove `useEffect` that calls `fetchTimeTrackingActive`
  - Update component to use `timeTrackingQuery.data` with fallback to `['hide-by-default']`

### Automated Tests

- [x] Automated test: Verify `useTimeTrackingActive` hook returns expected data structure (array of IDs) (packages/web-client/src/hooks/use_time_tracking_active.test.ts:46-56)
- [x] Automated test: Verify hook respects `enabled` parameter (packages/web-client/src/hooks/use_time_tracking_active.test.ts:58-69,71-82)
- [x] Automated test: Verify query key structure matches pattern (`['todos', 'byTimeTrackingActive']`) (packages/web-client/src/hooks/use_time_tracking_active.test.ts:84-98)

### User Tests

- [ ] User test: Start time tracking on a todo and verify it gets highlighted in the UI
- [ ] User test: Stop time tracking and verify highlight is removed
- [ ] User test: Verify multiple todos can have active time tracking simultaneously
