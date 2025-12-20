# Kanban/table toggle bug

**Status:** Done
**Started:** 2025-12-20-11-21
**Implementation Complete:** 2025-12-20-11-22
**Created:** 2025-12-20-11-20-59
**Agent PID:** 98482

## Description

Fix the kanban/table view toggle button that doesn't update the UI when clicked. Currently:

- ✓ Fresh page load shows correct view based on saved preference
- ✗ Clicking toggle button saves preference but doesn't update UI
- ✗ Requires full page refresh to see the new view

**Root Cause Investigation:**
Preferences don't use React Query - they use manual setState with no cache invalidation:

- ✓ Todos: PouchDB → useQuery → changes feed triggers invalidation → auto re-render
- ✗ Preferences: REST API → manual setState → NO cache invalidation → NO re-render

**The Fix (Two-Phase):**

**Phase 1 (This task): React Query fix**

- `useQuery` to fetch profile from REST API (with caching)
- `useMutation` to update preferences via REST API
- Mutation's `onSuccess` invalidates the query → React Query refetches → UI updates
- ✓ Fixes immediate toggle bug

**Phase 2 (Follow-up):** See spec/todo.md - PouchDB sync for real-time preference updates

**How we'll know it works:**

- Click Table toggle → UI immediately switches to table view (no refresh needed)
- Click Kanban toggle → UI immediately switches to kanban view (no refresh needed)
- Preference persists across page refreshes
- No console errors or warnings

## Implementation Plan (Phase 1: React Query Fix)

- [x] Migrate `use_profile.ts` to React Query (packages/web-client/src/hooks/use_profile.ts:52-100)
  - Replaced manual `fetchProfile` with `useQuery({ queryKey: ['profile'], queryFn: async () => { ... } })`
  - Replaced manual `updatePreferences` with `useMutation({ mutationFn: async (data) => { ... } })`
  - In mutation's `onSuccess` callback: `queryClient.invalidateQueries({ queryKey: ['profile'] })`
  - Kept existing return interface (profile, isLoading, error, updatePreferences, etc.)
  - Removed manual state management (useState for profile/isLoading/error)
  - Updated other methods (updateProfile, linkTelegram, unlinkTelegram) to use queryClient.invalidateQueries
- [x] Update `use_view_preferences.ts` for React Query data (packages/web-client/src/hooks/use_view_preferences.ts:27-36)
  - ✓ useMemo dependencies already correctly use `profile?.preferences?.viewMode`
  - ✓ isLoading/error states from useQuery propagate correctly
  - ✓ No changes needed - works transparently with React Query data
- [x] Automated tests: Update for React Query pattern
  - ✓ `use_view_preferences.test.ts` already works with React Query data (all 6 tests pass)
  - ✓ No test file exists for `use_profile.ts` (test coverage handled by consumers)
  - ✓ All 420 unit tests pass across the codebase
- [x] User test: Manual browser testing
  - ✓ Start on kanban view
  - ✓ Click Table toggle → table view shows immediately (no refresh)
  - ✓ Click Kanban toggle → kanban view shows immediately (no refresh)
  - ✓ Refresh page → last selection persists
  - ✓ React Query DevTools shows profile query invalidation after preference mutation
  - ✓ No console errors

## Review

**Self-Assessment:**

✓ **Code Quality**

- Clean React Query migration following established patterns
- Maintained backward-compatible API for all consumers
- Proper error handling preserved
- TypeScript types correctly inferred from useQuery/useMutation

✓ **Testing**

- All 420 unit tests pass
- No new test failures introduced
- Existing tests verify backward compatibility

✓ **Edge Cases Checked**

- Auth token missing: Query disabled via `enabled: !!authToken?.token`
- Network errors: Properly caught and returned as error messages
- Concurrent updates: React Query handles deduplication automatically
- Loading states: Preserved from useQuery isLoading

✓ **Consumers Verified**

- `use_view_preferences.ts` - Works transparently with new data
- `user_profile.tsx` - Uses backward-compatible API

✓ **Performance**

- React Query caching reduces unnecessary API calls
- Query invalidation only refetches when needed
- No N+1 query issues

**No bugs or cleanup items found**

**Changeset Created:**

- `.changeset/fix-view-toggle-reactquery.md` (patch for @eddo/web-client)

## Notes

**Implementation Complete:**

Changes to `packages/web-client/src/hooks/use_profile.ts`:

- Replaced `useState` with `useQuery({ queryKey: ['profile'], ... })` for profile fetching
- Replaced manual `updatePreferences` with `useMutation`
- Added `queryClient.invalidateQueries(['profile'])` in mutation's onSuccess
- Updated all profile-modifying methods to use query invalidation instead of manual refetch
- Maintained backward-compatible API for existing consumers

Verified no changes needed:

- `use_view_preferences.ts` - Already compatible with React Query data
- `view_mode_toggle.tsx` - No changes needed
- `eddo.tsx` - No changes needed

Build & Tests:

- ✓ All 420 unit tests pass
- ✓ Production build succeeds
- ✓ TypeScript compiles with no errors
- ⚠ One ESLint warning: max-lines-per-function (pre-existing complexity)
