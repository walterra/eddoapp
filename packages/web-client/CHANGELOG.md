# @eddo/web-client

## 0.6.0

### Minor Changes

- [#426](https://github.com/walterra/eddoapp/pull/426) [`f937285`](https://github.com/walterra/eddoapp/commit/f9372853bb347b07adc1e47ba037ad89fce461b1) - Add optional message field to audit log entries for human-readable activity descriptions

### Patch Changes

- [#436](https://github.com/walterra/eddoapp/pull/436) [`d65041f`](https://github.com/walterra/eddoapp/commit/d65041fb8f5fac6a3c285c337fb2cf84695763c0) - Add keyboard navigation for date periods - left/right arrow keys navigate to previous/next period

- [#438](https://github.com/walterra/eddoapp/pull/438) [`66cba25`](https://github.com/walterra/eddoapp/commit/66cba25a94e38774f83980dc89f8b96023e0d8b5) - Fix bug where user data persists after logout/login as different user. QueryClient is now recreated when username changes to ensure cache isolation between users.

- Updated dependencies [[`f9372853bb347b07adc1e47ba037ad89fce461b1`](https://github.com/walterra/eddoapp/commit/f9372853bb347b07adc1e47ba037ad89fce461b1)]:
  - @eddo/core-shared@0.6.0
  - @eddo/core-client@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @eddo/core-client@0.5.0
  - @eddo/core-shared@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @eddo/core-client@0.4.0
  - @eddo/core-shared@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @eddo/core-client@0.3.0
  - @eddo/core-shared@0.3.0

## 0.1.0

### Minor Changes

- be00d90: Add GitHub issue synchronization feature with automatic syncing of assigned issues to todos. Includes configurable sync intervals, force resync capability, SSO organization support, and smart change detection to minimize database writes.
- a077c52: Add externalId field for GitHub issue sync with parsing utilities and MCP server support
- 137afbf: Add flexible multi-filter system with status, context, and enhanced time range filtering
- a309824: Add thermal printer support for daily briefings on Epson TM-m30III
- d8671d5: Add table view with customizable columns and view mode toggle for kanban/table switching
- 3923b77: Add TanStack Query for improved data caching and real-time updates

### Patch Changes

- 20bc6a1: Update ESLint rules, dependencies, and CI configuration
- 462b542: Consolidate database structure definitions into core-shared package
- edaf174: Add filter state persistence - todo filters (tags, contexts, status, time range, date) now persist across page reloads
- 01c3849: Fix kanban/table view toggle to update UI immediately without requiring page refresh
- 600932a: Migrate to prettier-plugin-organize-imports for improved import formatting
- 1225c9f: Optimize CouchDB sync setup and memory issues
- 636ec5f: Show action icons only on hover to reduce visual clutter in todo cards
- 9e3dd6a: Split monolithic \_design/todos into separate design documents
- 568da08: Migrate time tracking data fetching to TanStack Query for consistency
- Updated dependencies [20bc6a1]
- Updated dependencies [462b542]
- Updated dependencies [edaf174]
- Updated dependencies [be00d90]
- Updated dependencies [a077c52]
- Updated dependencies [600932a]
- Updated dependencies [1225c9f]
- Updated dependencies [a309824]
- Updated dependencies [9e3dd6a]
- Updated dependencies [879e1bc]
  - @eddo/core-client@0.1.0
  - @eddo/core-shared@0.1.0
