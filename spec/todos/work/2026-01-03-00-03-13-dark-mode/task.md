# Implement dark mode as first-class citizen

**Status:** In Progress
**Started:** 2026-01-03-00-30-00
**Created:** 2026-01-03-00-03-13
**Agent PID:** 34113
**GitHub Issue:** [#352](https://github.com/walterra/eddoapp/issues/352)

## Description

Dark mode is expected for productivity tools. Currently, dark mode only works via OS preference detection (`prefers-color-scheme: dark` media query). The goal is to make dark mode a first-class citizen with:

- Manual theme toggle (system/light/dark)
- User preference persistence across sessions
- Intentionally designed dark mode styling (already exists via `dark:` Tailwind classes)

### Success Criteria

- [x] Dark mode feels intentionally designed, not auto-generated (existing dark: classes)
- [x] All interactive states work correctly in both modes
- [x] User preference persists across sessions (via localStorage + user profile API)
- [x] Theme toggle accessible in header area
- [x] System preference respected when user chooses "system"

## Implementation Plan

### 1. Update Tailwind config for class-based dark mode

- [x] Code change: `packages/web-client/tailwind.config.js` - change `darkMode: 'media'` to `darkMode: 'class'`

### 2. Add theme preference to user preferences types

- [x] Code change: `packages/core-shared/src/versions/user_registry_alpha2.ts` - add `theme?: 'system' | 'light' | 'dark'` to `UserPreferences` interface and default in `createDefaultUserPreferences()`
- [x] Code change: `packages/web-client/src/hooks/use_profile_types.ts` - add `theme?: 'system' | 'light' | 'dark'` to `UserPreferences` and `UpdatePreferencesData`

### 3. Create theme hook and context

- [x] Code change: `packages/web-client/src/hooks/use_theme.ts` - create hook that:
  - Reads theme from user profile preferences
  - Falls back to localStorage for unauthenticated users
  - Applies `dark` class to `<html>` element
  - Listens to system preference changes when theme is 'system'
  - Provides `theme`, `resolvedTheme`, and `setTheme` values
- [x] Code change: `packages/web-client/src/hooks/use_theme.test.ts` - unit tests

### 4. Add theme toggle component

- [x] Code change: `packages/web-client/src/components/theme_toggle.tsx` - dropdown/button group with system/light/dark options
- [x] Code change: `packages/web-client/src/components/theme_toggle.test.tsx` - unit tests

### 5. Integrate theme toggle into header

- [x] Code change: `packages/web-client/src/components/page_wrapper.tsx` - add ThemeToggle to Header component

### 6. Initialize theme on app load

- [x] Code change: `packages/web-client/src/eddo.tsx` - ensure theme is applied on initial render to prevent flash

### 7. Update design tokens for class-based dark mode

- [x] Code change: `packages/web-client/src/design-tokens.css` - change `@media (prefers-color-scheme: dark)` to `.dark` selector for semantic colors

### 8. Verification

- [x] Automated test: All existing tests pass (`pnpm test`)
- [x] Automated test: New hook and component tests pass
- [x] Automated test: TypeScript compiles without errors (`pnpm tsc:check`)
- [x] Automated test: Linting passes (`pnpm lint`)
- [x] User test: Toggle between system/light/dark modes
- [x] User test: Verify preference persists after page reload (via localStorage)
- [x] User test: Verify system preference is respected when "system" selected
- [x] User test: Verify all interactive states (hover, focus, active) work in both modes

## Review

- [x] Theme toggle functionality works correctly
- [x] Theme persists in localStorage
- [x] System preference detection works
- [x] Flowbite components now work in dark mode via `@custom-variant` directive
- [x] Improved dark mode color palette for better elevation hierarchy
- [ ] **Polish remaining**: Dark mode is functional but could use refinement:
  - Flowbite uses `gray-*` colors while app uses `neutral-*` (slight color mismatch)
  - Elevation distinction could be improved with subtle shadows
  - Input field borders could be more visible

## Notes

**Current state:**

- Tailwind config: `darkMode: 'media'` (OS preference only)
- Design tokens: Uses `@media (prefers-color-scheme: dark)` for semantic color aliases
- Components: 81 instances of `dark:` classes already exist
- No theme preference in user profile
- No theme toggle UI

**Key files:**

- `packages/web-client/tailwind.config.js`
- `packages/web-client/src/design-tokens.css`
- `packages/web-client/src/styles/interactive.ts`
- `packages/core-shared/src/versions/user_registry_alpha2.ts`

**Reference:** spec/design-principles.md section 4

**Implementation additions:**

- Added `@custom-variant dark (&:where(.dark, .dark *))` to enable class-based dark mode in Tailwind v4
- Improved dark mode color palette with better elevation layering (neutral-900 base instead of neutral-950)
- Adjusted border colors for better visibility in dark mode

**Remaining polish (can be addressed in "Audit component consistency" task #364):**

- Flowbite uses `gray-*` colors while app uses `neutral-*` (minor visual inconsistency)
- Login/Register/Profile pages could benefit from explicit dark mode background classes
- Consider adding subtle elevation shadows for card differentiation
