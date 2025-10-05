# split \_design/todos up into a design doc for each view

**Status:** In Progress
**Created:** 2025-10-05T17:36:28Z
**Started:** 2025-10-05T17:36:28Z
**Agent PID:** 81503

## Description

The codebase currently has a single `_design/todos` design document containing 3 views:

- `byActive` - Maps time tracking activities
- `byDueDate` - Maps todos by due date
- `byTimeTrackingActive` - Maps currently active time tracking entries

This task will split the monolithic `_design/todos` into three separate design documents, one per view:

- `_design/todos_by_active`
- `_design/todos_by_due_date`
- `_design/todos_by_time_tracking_active`

This separation provides better modularity and follows the existing pattern (the codebase already has `_design/tags` as a separate design document).

## Success Criteria

- [ ] **Functional**: Three separate design documents exist (`_design/todos_by_active`, `_design/todos_by_due_date`, `_design/todos_by_time_tracking_active`) with correct view definitions
- [ ] **Functional**: All existing hook queries return correct data after migration (todos grouped by week, activities by week, active time tracking entries)
- [ ] **Functional**: Original `_design/todos` design document is removed from the definitions
- [ ] **Build validation**: TypeScript compilation passes (`pnpm tsc:check`)
- [ ] **Code quality**: Linting and formatting pass (`pnpm lint`, `pnpm format`)
- [ ] **User validation**: Manual testing confirms todos display correctly in web UI, time tracking works, and no console errors appear

## Implementation Plan

- [x] Split `_design/todos` into three separate design documents in `/Users/walterra/dev/eddoapp/packages/core-shared/src/api/database-structures.ts:23-52`
- [x] Update query call in `/Users/walterra/dev/eddoapp/packages/web-client/src/hooks/use_activities_by_week.ts:40` to use `'todos_by_active'` design doc name
- [x] Update query call in `/Users/walterra/dev/eddoapp/packages/web-client/src/hooks/use_todos_by_week.ts:40` to use `'todos_by_due_date'` design doc name
- [x] Update query call in `/Users/walterra/dev/eddoapp/packages/web-client/src/hooks/use_time_tracking_active.ts:28` to use `'todos_by_time_tracking_active'` design doc name
- [x] Automated test: Run TypeScript type checking (`pnpm tsc:check`)
- [x] Automated test: Run linting (`pnpm lint`)
- [x] Automated test: Run formatting check (`pnpm format`)
- [x] Automated test: Run existing unit tests (`pnpm test`)
- [ ] User test: Start dev server and verify todos display correctly in the web UI
- [ ] User test: Verify time tracking functionality works (start/stop tracking)
- [ ] User test: Check browser console for errors during normal usage

## Review

## Notes
