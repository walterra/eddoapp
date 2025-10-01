# Add TanStack Query to web client

**Status:** Refining
**Created:** 2025-10-01T20:27:41Z
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

- [ ] Functional: TanStack Query successfully fetches todos and activities for current week with correct date range parameters
- [ ] Functional: PouchDB changes feed triggers automatic query invalidation and refetch when database changes occur
- [ ] Functional: Loading and error states render correctly using TanStack Query's built-in state management
- [ ] Code Quality: Manual coordination code removed (no isFetching/shouldFetch refs in todo_board.tsx)
- [ ] Performance: Query deduplication works - multiple calls to fetch same week data only execute once
- [ ] User Validation: Manual testing confirms board still displays todos grouped by context and date, with real-time updates working

## Implementation Plan

- [ ] Install @tanstack/react-query and @tanstack/react-query-devtools (pnpm add --filter @eddo/web-client)
- [ ] Create QueryClient configuration with offline-first settings (packages/web-client/src/config/query_client.ts)
- [ ] Add QueryClientProvider wrapper in Eddo component (packages/web-client/src/eddo.tsx:116-117)
- [ ] Create custom hook useTodosByWeek (packages/web-client/src/hooks/use_todos_by_week.ts)
- [ ] Create custom hook useActivitiesByWeek (packages/web-client/src/hooks/use_activities_by_week.ts)
- [ ] Integrate query invalidation with DatabaseChangesProvider (packages/web-client/src/hooks/use_database_changes.tsx)
- [ ] Refactor TodoBoard to use TanStack Query hooks (packages/web-client/src/components/todo_board.tsx:88-262)
- [ ] Remove manual state management code from TodoBoard (useState for todos, activities, isLoading, error)
- [ ] Remove concurrency control refs (isFetching, shouldFetch) from TodoBoard
- [ ] Automated test: Build passes with pnpm build
- [ ] Automated test: TypeScript check passes with pnpm tsc:check
- [ ] Automated test: Lint passes with pnpm lint
- [ ] Automated test: Existing tests pass with pnpm test
- [ ] User test: Start dev server, verify TodoBoard displays todos grouped by context and date
- [ ] User test: Create/modify a todo, verify board updates in real-time without manual refresh
- [ ] User test: Check browser DevTools console for query deduplication (no duplicate fetches)
