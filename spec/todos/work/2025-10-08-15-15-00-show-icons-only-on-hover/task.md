# show icons only on hover

**Status:** In Progress
**Created:** 2025-10-08T15:15:00Z
**Started:** 2025-10-08T15:20:00Z
**Agent PID:** 73299

## Original Todo

show icons only on hover

## Description

Implement hover-only visibility for action icons in the TodoListElement component. Currently, the edit and time tracking (play/pause) icons are always visible on every todo card, which creates visual clutter. These icons should be hidden by default and only appear when the user hovers over a todo item card, creating a cleaner interface while keeping functionality easily accessible.

**Context**: The web client uses TailwindCSS with react-icons (BiEdit, BiPlayCircle, BiPauseCircle). Currently, icons use standard button hover effects (background color changes) but remain visible at all times. The implementation will use Tailwind's `group` and `group-hover` pattern with opacity transitions.

## Success Criteria

- [ ] Functional: Edit and time tracking icons hidden by default (opacity-0) on todo cards
- [ ] Functional: Icons appear smoothly on hover over todo card with transition effect
- [ ] Functional: Icons remain accessible via keyboard navigation (focus states reveal icons)
- [ ] Functional: Hover behavior works correctly in both light and dark modes
- [ ] User validation: Manual test confirms icons appear/disappear on hover in multiple browsers

## Implementation Plan

- [x] Add `group` class to todo card container div (packages/web-client/src/components/todo_list_element.tsx:139)
- [x] Add `opacity-0 group-hover:opacity-100 transition-opacity duration-200` classes to play/pause button (packages/web-client/src/components/todo_list_element.tsx:200-204)
- [x] Add `opacity-0 group-hover:opacity-100 transition-opacity duration-200` classes to edit button (packages/web-client/src/components/todo_list_element.tsx:222)
- [x] Add `focus-within:opacity-100` to both buttons to ensure keyboard navigation reveals icons
- [x] Fix pause button to always show (opacity-100) when time tracking is active (packages/web-client/src/components/todo_list_element.tsx:200-204)
- [x] Automated test: Run `pnpm tsc:check` and `pnpm lint` to verify no type/lint errors
- [ ] User test: Load web client, verify icons hidden by default on todo cards
- [ ] User test: Verify pause button always visible when time tracking is active
- [ ] User test: Hover over todo cards, verify icons appear smoothly with transition
- [ ] User test: Use Tab key to navigate to buttons, verify icons appear on focus
- [ ] User test: Test in dark mode, verify hover behavior works correctly
