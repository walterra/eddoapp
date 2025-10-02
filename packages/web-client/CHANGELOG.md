# @eddo/web-client

## 0.1.0

### Minor Changes

- 3923b77: Add TanStack Query for data caching and state management in TodoBoard

  Integrate TanStack Query to replace manual data fetching and state management in the web client. This creates a hybrid architecture where TanStack Query handles caching/state management and PouchDB changes feed handles real-time updates.

  Key improvements:
  - Eliminates manual coordination code (isFetching/shouldFetch refs)
  - Replaces manual state management (isLoading, error, todos, activities)
  - Provides better TypeScript inference and built-in DevTools
  - Enables automatic query deduplication
  - Improves developer experience with standardized patterns

### Patch Changes

- 462b542: Consolidate database structure definitions into core-shared package
- 600932a: Migrate from @trivago/prettier-plugin-sort-imports to prettier-plugin-organize-imports for improved import formatting. This change standardizes import organization across all packages using TypeScript's language service API, providing consistent type import handling and automatic alphabetical sorting within logical groups.
- 1225c9f: Optimize CouchDB sync setup and memory issues
- Updated dependencies [462b542]
- Updated dependencies [600932a]
- Updated dependencies [1225c9f]
  - @eddo/core-shared@0.0.2
  - @eddo/core-client@0.0.2
