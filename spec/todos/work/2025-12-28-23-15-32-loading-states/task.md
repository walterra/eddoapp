# Implement Loading States for Async Operations

**Status:** In Progress
**Started:** 2025-12-28-23-18
**Created:** 2025-12-28-23-15-32
**Agent PID:** 92504
**GitHub Issue:** [#30](https://github.com/walterra/eddoapp/issues/30)

## Description

Add loading states for async operations using TanStack Query best practices. The original GitHub issue predates the TanStack Query refactor. The app now uses TanStack Query with optimistic updates. This task focuses on adding visual loading indicators where they're missing.

**Success criteria:**

- TodoBoard shows loading spinner during initial data fetch
- TodoTable shows loading spinner during initial data fetch
- Loading spinners are accessible (aria attributes)
- Consistent visual loading patterns using Flowbite Spinner component

## Investigation Findings

**Current TanStack Query setup (already in place):**

- `useTodosByWeek` - useQuery for fetching todos
- `useTodoMutation` - useMutation with optimistic updates
- `useCreateTodoMutation` - useMutation for creating todos
- `useDeleteTodoMutation` - useMutation with optimistic updates
- `useSaveTodoMutation` - useMutation for saving/updating todos
- `useToggleCompletionMutation` - useMutation for completion toggle
- `useToggleTimeTrackingMutation` - useMutation for time tracking

**Already has loading states (no changes needed):**

- `AddTodo` - Uses `isPending` from createTodoMutation, shows "Adding..." text
- `TodoListElement` - Uses `isPending` from mutations, disables buttons during update
- `UserProfile` - Comprehensive loading states with `isLoading`

**Missing loading states:**

- `TodoBoard` - Has `isLoading` from queries but doesn't display spinner
- `TodoTable` - Has `isLoading` from queries but doesn't display spinner

**Available resources:**

- Flowbite-react has a `Spinner` component ready to use
- Both components already compute `isLoading` state

## Implementation Plan

- [x] Create `useDelayedLoading` hook to prevent flicker (packages/web-client/src/hooks/use_delayed_loading.ts)
  - Returns loading state only after 200ms delay
  - Prevents flicker for fast operations
- [x] Add loading spinner to TodoBoard (packages/web-client/src/components/todo_board.tsx)
  - Import `Spinner` from flowbite-react
  - Use `useDelayedLoading` for delayed loading state
  - Show centered spinner with "Loading todos..." text
  - Add aria-label for accessibility
- [x] Add loading spinner to TodoTable (packages/web-client/src/components/todo_table.tsx)
  - Import `Spinner` from flowbite-react
  - Use `useDelayedLoading` for delayed loading state
  - Show centered spinner with "Loading todos..." text
  - Add aria-label for accessibility
- [x] Add unit tests for loading state rendering
  - Tests for `useDelayedLoading` hook (6 tests)
  - Tests for TodoBoard loading states (2 tests)
- [ ] Manual testing: verify spinners appear on initial load

## Review

- [ ] Accessibility audit (aria-label on spinners)
- [ ] Visual consistency check (same spinner style in both views)
- [ ] No loading flicker on fast loads (TanStack Query handles this with stale-while-revalidate)

## Notes

TanStack Query states:

- `isLoading` - true on first fetch when no cached data exists
- `isFetching` - true when any fetch is happening (including background refetch)
- `isPending` - mutation in progress

We use `isLoading && !data` pattern to show spinner only on initial load, not on background refetches (which would cause flicker).
