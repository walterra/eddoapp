# Audit and unify component consistency

**Status:** Done
**Started:** 2026-01-03-10-43
**Created:** 2026-01-03-10-40-29
**Agent PID:** 88304
**GitHub Issue:** [#364](https://github.com/walterra/eddoapp/issues/364)

## Description

Audit all UI components for visual consistency and unify styling patterns. Every touchpoint reinforces or undermines trust - visual inconsistencies undermine the sense of quality.

### Success Criteria

- All buttons of same type look identical
- Cards have consistent styling across kanban/table views
- No visual inconsistencies between components
- Design feels cohesive and intentional
- Consistent border-radius, spacing, colors, and icon usage

## Audit Findings

### 1. Border-Radius Inconsistencies

- **rounded-lg** (17 occurrences): dropdowns, cards, error messages, inputs
- **rounded-full** (11 occurrences): tags, badges, toggle switch knob, health indicators
- **rounded-md** (4 occurrences): tag suggestions dropdown, error message (database_error_message.tsx)
- **rounded** (plain, ~10 occurrences): icon buttons, time-range filter inputs, todo cards

**Issue**: Todo cards use `rounded` while dropdowns/modals use `rounded-lg`. The tag_input.tsx uses `rounded-md` for suggestions but `rounded-lg` for the container.

### 2. Button Style Inconsistencies

**Primary buttons** (various patterns):

- `database_error_fallback.tsx`: `bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 rounded px-4 py-2`
- `time_range_filter.tsx`: `bg-primary-600 w-full rounded px-2 py-1 text-xs`
- Flowbite `<Button color="blue">`: Used in login, register, add_todo, user_profile

**Secondary/Gray buttons**:

- `database_error_fallback.tsx`: `rounded bg-neutral-200 px-4 py-2 text-neutral-700 hover:bg-neutral-300`
- `database_error_fallback.tsx`: `rounded border border-neutral-300 px-4 py-2 text-neutral-600 hover:bg-neutral-50`
- Flowbite `<Button color="gray">`: Used in todo_filters, user_profile_github_section

**Issue**: Mixing Flowbite Button components with custom button styles. Custom buttons use `rounded` while Flowbite uses `rounded-lg`.

### 3. Icon Button Inconsistencies

- `todo_list_element.tsx`: `rounded p-1` with `text-neutral-400 hover:text-neutral-600`
- `todo_table_row.tsx`: `rounded p-0.5` with same hover pattern
- `interactive.ts` defines `ICON_BUTTON` but not all components use it

**Issue**: Different padding (`p-1` vs `p-0.5`) between kanban cards and table rows.

### 4. Card/Container Inconsistencies

- **Kanban cards** (`todo_list_element.tsx`): `rounded border border-neutral-200 bg-white px-2 py-1 hover:shadow-md`
- **Dropdowns** (filters): `rounded-lg border border-neutral-200 bg-white p-3 shadow-lg`
- **Error fallback**: `rounded-lg bg-white p-6 shadow-lg`
- **GitHub section**: `rounded-lg border p-4`

**Issue**: Cards use `rounded`, containers use `rounded-lg`. Inconsistent shadow and padding.

### 5. Color Usage Patterns

**Primary colors** - Generally consistent:

- Active states: `bg-primary-100 text-primary-800` (light) / `bg-primary-900 text-primary-300` (dark)
- Links: `text-primary-600 hover:text-primary-800`

**Error colors** - Consistent:

- `bg-error-50 border-error-200 text-error-700` pattern

**Neutral text** - Too many variations:

- Body text: `text-neutral-700`, `text-neutral-600`, `text-neutral-900`
- Muted text: `text-neutral-500`, `text-neutral-400`

### 6. Spacing Inconsistencies

- Padding varies: `p-1`, `p-2`, `p-3`, `p-4`, `p-6`, `p-8`
- Button padding: `px-2 py-1`, `px-3 py-2`, `px-4 py-2`
- Gap/spacing: `gap-0.5`, `gap-1`, `gap-2`, `gap-3`, `gap-4`

### 7. Focus Ring Inconsistencies

- `interactive.ts` defines standard `FOCUS_RING` but not all components use it
- Some buttons have custom focus styles: `focus:ring-2 focus:ring-neutral-500 focus:outline-none`
- `toggle_switch.tsx`: Uses `focus:ring-primary-500 focus:ring-2 focus:ring-offset-2`
- `view_mode_toggle.tsx`: No focus ring defined

## Implementation Plan

### Phase 1: Extend Design Tokens (interactive.ts)

- [x] Add card style tokens (CARD_BASE, CARD_INTERACTIVE)
- [x] Add standard button tokens (BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_PRIMARY_SM)
- [x] Add dropdown/popover container token (DROPDOWN_CONTAINER)
- [x] Add toggle button group tokens (TOGGLE_GROUP, TOGGLE_BUTTON_ACTIVE, TOGGLE_BUTTON_INACTIVE)
- [x] Add INPUT_BASE token
- [x] Add getToggleButtonClass helper function

### Phase 2: Unify Button Styles

- [x] Update database_error_fallback.tsx to use BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST tokens
- [x] Update time_range_filter.tsx Apply button to use BTN_PRIMARY_SM token
- [x] Update database_error_fallback.tsx card to use CARD_BASE token

### Phase 3: Unify Card Styles

- [x] Update todo_list_element.tsx to use CARD_INTERACTIVE (rounded-lg)
- [x] Update todo_list_element.tsx to use TEXT_LINK token for links
- [x] Update todo_list_element.tsx to use ICON_BUTTON token
- [x] Changed active indicator from border-sky-600 to ring-sky-600 for consistency

### Phase 4: Unify Icon Buttons

- [x] Standardize icon button padding (p-1 everywhere via ICON_BUTTON token)
- [x] Update todo_table_row.tsx to use ICON_BUTTON from interactive.ts

### Phase 5: Unify Dropdown Containers

- [x] Update tag_input.tsx to use DROPDOWN_CONTAINER token (rounded-lg)
- [x] Update column_picker.tsx to use DROPDOWN_CONTAINER token
- [x] Update eddo_context_filter.tsx to use DROPDOWN_CONTAINER token
- [x] Update status_filter.tsx to use DROPDOWN_CONTAINER token
- [x] Update tag_filter.tsx to use DROPDOWN_CONTAINER token
- [x] Update time_range_filter.tsx to use DROPDOWN_CONTAINER token

### Phase 6: Unify Focus Rings

- [x] Update view_mode_toggle.tsx to use TOGGLE_GROUP and getToggleButtonClass (includes FOCUS_RING_INSET)
- [x] Update toggle_switch.tsx to use FOCUS_RING token
- [x] Update todo_filters.tsx period button to use rounded-lg

### Phase 7: Verification

- [x] Automated test: TypeScript check passes
- [x] Automated test: Lint passes
- [x] Automated test: Unit tests pass (fixed 3 failing tests)
- [x] Automated test: Build passes
- [ ] User test: Visual inspection of all component types in UI

## Review

- [x] Fixed test regression in database_error_fallback.test.tsx (updated button class assertions)
- [x] Fixed test regression in todo_list_element.test.tsx (changed border-sky-600 to ring-sky-600)
- [x] Fixed test regression in database_error_message.test.tsx (rounded-md → rounded-lg)
- [x] Fixed WebKit hover bug - Tailwind v4's `@media(hover:hover)` wrapper fails in some WebKit browsers
- [x] Converted oklch colors to hex in design-tokens.css for broader browser support
- [x] Verified hover works in Chrome and Orion (WebKit)

## Notes

Reference: spec/design-principles.md section 14

**Key insight**: The codebase already has a good foundation with `interactive.ts` defining tokens. The issue is incomplete adoption and some ad-hoc styling in individual components.

### Files Modified

- `packages/web-client/src/styles/interactive.ts` - Extended with new design tokens
- `packages/web-client/src/components/database_error_fallback.tsx` - Use button and card tokens
- `packages/web-client/src/components/time_range_filter.tsx` - Use BTN_PRIMARY_SM, DROPDOWN_CONTAINER, INPUT_BASE
- `packages/web-client/src/components/todo_list_element.tsx` - Use CARD_INTERACTIVE, ICON_BUTTON, TEXT_LINK
- `packages/web-client/src/components/todo_table_row.tsx` - Use ICON_BUTTON
- `packages/web-client/src/components/tag_input.tsx` - Use DROPDOWN_CONTAINER, DROPDOWN_ITEM
- `packages/web-client/src/components/column_picker.tsx` - Use DROPDOWN_CONTAINER
- `packages/web-client/src/components/eddo_context_filter.tsx` - Use DROPDOWN_CONTAINER
- `packages/web-client/src/components/status_filter.tsx` - Use DROPDOWN_CONTAINER
- `packages/web-client/src/components/tag_filter.tsx` - Use DROPDOWN_CONTAINER
- `packages/web-client/src/components/view_mode_toggle.tsx` - Use TOGGLE_GROUP, getToggleButtonClass
- `packages/web-client/src/components/toggle_switch.tsx` - Use FOCUS_RING, TRANSITION
- `packages/web-client/src/components/todo_filters.tsx` - Use rounded-lg for period button
- `packages/web-client/src/components/database_error_fallback.test.tsx` - Updated assertions
- `packages/web-client/src/components/todo_list_element.test.tsx` - Updated active state assertion
- `packages/web-client/src/components/database_error_message.tsx` - rounded-md → rounded-lg
- `packages/web-client/src/components/todo_edit_modal_error.tsx` - rounded-md → rounded-lg
- `packages/web-client/src/components/todo_table.tsx` - rounded → rounded-lg
- `packages/web-client/src/components/database_error_message.test.tsx` - Updated rounded-md → rounded-lg assertion
- `packages/web-client/src/design-tokens.css` - Converted oklch colors to hex for WebKit compatibility
- `packages/web-client/src/eddo.css` - Added `@variant hover (&:hover)` to fix WebKit hover states

### WebKit Hover Fix

Tailwind CSS v4 wraps hover states in `@media(hover:hover)` by default. This media query fails in some WebKit browsers (Safari, Orion) causing hover styles to not apply. Fixed by adding `@variant hover (&:hover);` to override this behavior.

### Dropdown Hover Performance

Reduced transition duration for dropdown items from 200ms to 75ms (`TRANSITION_FAST`). The slower transition caused a brittle/inconsistent feel when rapidly hovering between menu items.
