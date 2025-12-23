# All UI actions should use TanStack Query mutations

**Status:** Done
**Started:** 2025-12-23-11-47
**GitHub Issue:** https://github.com/walterra/eddoapp/issues/294
**Created:** 2025-12-23-11-45-59
**Agent PID:** 37321

## Description

Migrate all direct PouchDB/API calls in UI components to use TanStack Query mutations for consistent state management, optimistic updates, and error handling.

**Success Criteria:**

1. All UI data mutations go through TanStack Query mutations
2. Consistent loading/error states via mutation `isPending`/`isError`
3. Optimistic updates where appropriate
4. Existing tests pass with updated mocks

## Implementation Plan

### Phase 1: Todo Mutations (add_todo.tsx, todo_edit_modal.tsx)

- [x] Create `useCreateTodoMutation` in `use_todo_mutations.ts` for adding todos
- [x] Create `useDeleteTodoMutation` in `use_todo_mutations.ts` for deleting todos
- [x] Create `useSaveTodoMutation` in `use_todo_mutations.ts` for editing todos
- [x] Migrate `add_todo.tsx` to use `useCreateTodoMutation`
- [x] Migrate `todo_edit_modal.tsx` to use `useSaveTodoMutation` and `useDeleteTodoMutation`
- [x] Update component tests for profile mock changes

### Phase 2: Profile Mutations (use_profile.ts)

- [x] Create `useUpdateProfileMutation` in `use_profile.ts`
- [x] Create `useChangePasswordMutation` in `use_profile.ts`
- [x] Create `useLinkTelegramMutation` in `use_profile.ts`
- [x] Create `useUnlinkTelegramMutation` in `use_profile.ts`
- [x] Create `useGithubResyncMutation` in `use_profile.ts`
- [x] Update return interface to expose mutation states
- [x] Update `user_profile.tsx` to use mutation loading/error states

### Phase 3: Verification

- [x] Run `pnpm lint` - passes (only pre-existing warnings)
- [x] Run `pnpm tsc:check` - passes
- [x] Run `pnpm test` - passes (462 passed)
- [x] User test: Add a todo, verify it appears immediately
- [x] User test: Edit a todo, verify changes appear immediately
- [x] User test: Delete a todo, verify it disappears immediately
- [x] User test: Toggle completion, verify state updates immediately

## Review

- [x] Fixed cache issue: todos moving between days now correctly update views
- [x] Fixed PouchDB limit bug: safeFind queries now use limit=10000 to fetch all results

## Notes

**Changes Made:**

1. **use_todo_mutations.ts**:
   - Added `useCreateTodoMutation` - invalidates queries on success
   - Added `useDeleteTodoMutation` - optimistic removal from cache
   - Added `useSaveTodoMutation` - direct save without optimistic updates, invalidates all queries on success

2. **add_todo.tsx**: Migrated from direct `safeDb.safePut()` to `useCreateTodoMutation`

3. **todo_edit_modal.tsx**: Migrated from direct PouchDB calls to mutations

4. **use_profile.ts**: All API calls now use mutations, exposed via `mutations` object

5. **user_profile.tsx**: `handleForceResync` now uses `mutations.githubResync.mutateAsync()`

6. **Critical Bug Fix - PouchDB limit**:
   - PouchDB's `find()` defaults to limit=25
   - With 5451 documents, only first 25 were returned
   - Fixed by adding `{ limit: 10000 }` to all `safeFind` calls in:
     - `use_todos_by_week.ts`
     - `use_activities_by_week.ts`
     - `use_time_tracking_active.ts`

7. **Cache invalidation fix**: `useSaveTodoMutation` now invalidates all todo queries on success to handle due date changes correctly
