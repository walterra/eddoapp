---
'@eddo/web-client': minor
---

Add TanStack Query for data caching and state management in TodoBoard

Integrate TanStack Query to replace manual data fetching and state management in the web client. This creates a hybrid architecture where TanStack Query handles caching/state management and PouchDB changes feed handles real-time updates.

Key improvements:

- Eliminates manual coordination code (isFetching/shouldFetch refs)
- Replaces manual state management (isLoading, error, todos, activities)
- Provides better TypeScript inference and built-in DevTools
- Enables automatic query deduplication
- Improves developer experience with standardized patterns
