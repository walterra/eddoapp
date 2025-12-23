# @eddo/web-client

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
