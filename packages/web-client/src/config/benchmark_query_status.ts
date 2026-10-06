import type { QueryClient } from '@tanstack/react-query';

interface BenchmarkQueryStatus {
  fetching: number;
  queryCount: number;
}

declare global {
  interface Window {
    __eddoBenchmarkQueryStatus?: () => BenchmarkQueryStatus;
  }
}

/** Exposes query counts only when the isolated benchmark explicitly enables observation. */
export function exposeBenchmarkQueryStatus(client: QueryClient): void {
  if (typeof window === 'undefined' || sessionStorage.getItem('eddoBenchmark') !== 'true') return;
  window.__eddoBenchmarkQueryStatus = () => ({
    fetching: client.isFetching(),
    queryCount: client.getQueryCache().getAll().length,
  });
}
