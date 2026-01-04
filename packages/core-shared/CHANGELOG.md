# @eddo/core-shared

## 0.4.0

## 0.3.0

## 0.1.0

### Minor Changes

- a077c52: Add externalId field for GitHub issue sync with parsing utilities and MCP server support
- 879e1bc: Add tag-based repeat behavior for todos: gtd:calendar repeats from due date, gtd:habit repeats from completion date

### Patch Changes

- 20bc6a1: Update ESLint rules, dependencies, and CI configuration
- 462b542: Consolidate database structure definitions into core-shared package
- edaf174: Add filter state persistence - todo filters (tags, contexts, status, time range, date) now persist across page reloads
- be00d90: Add GitHub issue synchronization feature with automatic syncing of assigned issues to todos. Includes configurable sync intervals, force resync capability, SSO organization support, and smart change detection to minimize database writes.
- 600932a: Migrate to prettier-plugin-organize-imports for improved import formatting
- a309824: Add thermal printer support for daily briefings on Epson TM-m30III
- 9e3dd6a: Split monolithic \_design/todos into separate design documents
