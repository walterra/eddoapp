import { QueryClient } from '@tanstack/react-query';

/**
 * Creates and configures a QueryClient for TanStack Query with offline-first settings.
 *
 * Configuration philosophy:
 * - staleTime: Infinity - Data never auto-refetches, only updates via PouchDB changes feed
 * - gcTime: 24 hours - Keep unused data cached for better offline experience
 * - retry: 1 - Limited retries suitable for offline scenarios
 * - refetchOnWindowFocus: false - Changes feed handles real-time updates
 * - refetchOnReconnect: false - Changes feed handles reconnection scenarios
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
