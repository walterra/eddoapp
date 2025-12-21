# Make calendar navigation text clickable to return to current week/month/day

**Status:** In Progress
**Created:** 2025-12-21-18-18-30
**Started:** 2025-12-21-18-19-54
**Agent PID:** 98482

## Description

Make the calendar period label (e.g., "CW51", "Dec 2024", "Jan 15, 2025") clickable to return to the current week/month/day. Currently, the label is a non-interactive `<span>` element. When clicked, it should reset `currentDate` to `new Date()`, effectively navigating to "today" in the context of the selected time range type.

**Success Criteria:**

- Period label text is visually clickable (cursor pointer, hover state)
- Clicking the label resets the calendar view to the current period
- Works correctly for all time range types: Day, Week, Month, Year
- Maintains existing styling and accessibility
- Existing navigation arrows continue to work

## Implementation Plan

- [ ] Convert period label from `<span>` to `<button>` element (packages/web-client/src/components/todo_filters.tsx:152)
- [ ] Add click handler to reset `currentDate` to `new Date()`
- [ ] Add hover styles and cursor pointer for better UX
- [ ] Ensure accessibility (semantic HTML, keyboard navigation)
- [ ] Add automated test: clicking label resets to current date
- [ ] User test: Navigate to past/future week, click label, verify returns to current week

## Review

[To be added during review phase]

## Notes

[Important findings will be captured here]
