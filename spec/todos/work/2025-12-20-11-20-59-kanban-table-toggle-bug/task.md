# Kanban/table toggle bug

**Status:** In Progress
**Started:** 2025-12-20-11-21
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

- [ ] Migrate `use_profile.ts` to React Query (packages/web-client/src/hooks/use_profile.ts:52-100)
  - Replace manual `fetchProfile` with `useQuery({ queryKey: ['profile'], queryFn: async () => { ... } })`
  - Replace manual `updatePreferences` with `useMutation({ mutationFn: async (data) => { ... } })`
  - In mutation's `onSuccess` callback: `queryClient.invalidateQueries({ queryKey: ['profile'] })`
  - Keep existing return interface (profile, isLoading, error, updatePreferences, etc.)
  - Remove manual state management (useState for profile/isLoading/error)
  - Keep other methods (updateProfile, changePassword, linkTelegram, etc.) as-is for now
- [ ] Update `use_view_preferences.ts` for React Query data (packages/web-client/src/hooks/use_view_preferences.ts:27-36)
  - Update `useMemo` dependencies to use `profile?.preferences?.viewMode` from useQuery data
  - Ensure isLoading/error states from useQuery propagate correctly
  - No API changes needed - should work transparently
- [ ] Automated tests: Update for React Query pattern
  - Update `use_profile.test.ts` - wrap tests in QueryClientProvider, mock useQuery/useMutation
  - Update `use_view_preferences.test.ts` - verify it works with React Query data
  - Add test: mutation → invalidation → refetch → re-render
- [ ] User test: Manual browser testing
  - Start on kanban view
  - Click Table toggle → table view shows immediately (no refresh)
  - Click Kanban toggle → kanban view shows immediately (no refresh)
  - Refresh page → last selection persists
  - Open React Query DevTools → verify profile query invalidates after preference mutation
  - Check console for errors

## Review

[To be completed during review phase]

## Notes

**Files involved:**

- `packages/web-client/src/hooks/use_profile.ts` - Profile management (main changes here)
- `packages/web-client/src/hooks/use_view_preferences.ts` - View mode state (minor updates)
- `packages/web-client/src/components/view_mode_toggle.tsx` - Toggle button (no changes)
- `packages/web-client/src/eddo.tsx` - Main app (no changes)
