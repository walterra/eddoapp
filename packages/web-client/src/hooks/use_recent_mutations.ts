/**
 * Shared set of recently mutated document IDs.
 * Used by mutation hooks to mark documents that shouldn't trigger query invalidation
 * from the PouchDB changes listener (since we already optimistically updated the cache).
 */

/** Track recently mutated document IDs to skip redundant invalidations */
export const recentMutations = new Set<string>();
