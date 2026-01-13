import { QueryClient } from '@tanstack/react-query';

/**
 * Creates and configures a QueryClient for TanStack Query with offline-first settings.
 *
 * Configuration philosophy:
 * - staleTime: Infinity - Data never auto-refetches, only updates via PouchDB changes feed
 * - gcTime: 5 minutes - Short cache lifetime to prevent memory bloat during navigation
 *   (With 10MB DB, each date range query can cache thousands of todos)
 * - retry: 1 - Limited retries suitable for offline scenarios
 * - refetchOnWindowFocus: false - Changes feed handles real-time updates
 * - refetchOnReconnect: false - Changes feed handles reconnection scenarios
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 5, // 5 minutes - prevents memory bloat on navigation
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
