# Add TanStack Query to web client

**Status:** Done
**Created:** 2025-10-01T20:27:41Z
**Started:** 2025-10-01T20:32:15Z
**Agent PID:** 30042

## Original Todo

let's add tanstack query to the web client (https://tanstack.com/query/latest/docs/framework/react/overview) - start by optimizing fetchTodos using tanstack query in todo_board.tsx

## Description

Integrate TanStack Query to replace manual data fetching and state management in the web client, starting with todo_board.tsx. The current implementation uses manual state management with useState for todos, activities, loading, and error states, plus custom concurrency control using refs (isFetching, shouldFetch) to prevent race conditions.

TanStack Query will eliminate this manual coordination code while keeping the existing PouchDB changes feed for real-time invalidation. This creates a hybrid architecture where TanStack Query handles caching/state management and PouchDB changes feed handles real-time updates.

Benefits:

- Eliminates manual coordination code (isFetching/shouldFetch refs)
- Replaces manual state (isLoading, error, todos, activities)
- Provides better TypeScript inference and built-in DevTools
- Enables automatic query deduplication
- Improves developer experience with standardized patterns

## Success Criteria

- [x] Functional: TanStack Query successfully fetches todos and activities for current week with correct date range parameters
- [x] Functional: PouchDB changes feed triggers automatic query invalidation and refetch when database changes occur
- [x] Functional: Loading and error states render correctly using TanStack Query's built-in state management
- [x] Code Quality: Manual coordination code removed (no isFetching/shouldFetch refs in todo_board.tsx)
- [x] Performance: Query deduplication works - multiple calls to fetch same week data only execute once
- [x] User Validation: Manual testing confirms board still displays todos grouped by context and date, with real-time updates working

## Implementation Plan

- [x] Install @tanstack/react-query and @tanstack/react-query-devtools (pnpm add --filter @eddo/web-client)
- [x] Create QueryClient configuration with offline-first settings (packages/web-client/src/config/query_client.ts)
- [x] Add QueryClientProvider wrapper in Eddo component (packages/web-client/src/eddo.tsx:116-117)
- [x] Create custom hook useTodosByWeek (packages/web-client/src/hooks/use_todos_by_week.ts)
- [x] Create custom hook useActivitiesByWeek (packages/web-client/src/hooks/use_activities_by_week.ts)
- [x] Integrate query invalidation with DatabaseChangesProvider (packages/web-client/src/hooks/use_database_changes.tsx)
- [x] Refactor TodoBoard to use TanStack Query hooks (packages/web-client/src/components/todo_board.tsx:88-262)
- [x] Remove manual state management code from TodoBoard (useState for todos, activities, isLoading, error)
- [x] Remove concurrency control refs (isFetching, shouldFetch) from TodoBoard
- [x] Automated test: Build passes with pnpm build
- [x] Automated test: TypeScript check passes with pnpm tsc:check
- [x] Automated test: Lint passes with pnpm lint
- [x] Automated test: Existing tests pass with pnpm test (365 tests passed)
- [x] User test: Start dev server, verify TodoBoard displays todos grouped by context and date
- [x] User test: Create/modify a todo, verify board updates in real-time without manual refresh
- [x] User test: Check browser DevTools console for query deduplication (no duplicate fetches)

## Notes

### Test Fixes

All TodoBoard tests now pass. The test-utils.tsx already had QueryClientProvider properly configured in the TestWrapper component (lines 42-57), creating a new QueryClient for each test with appropriate settings.
