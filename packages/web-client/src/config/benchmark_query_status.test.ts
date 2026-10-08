import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { exposeBenchmarkQueryStatus } from './benchmark_query_status';

afterEach(() => {
  sessionStorage.removeItem('eddoBenchmark');
  delete window.__eddoBenchmarkQueryStatus;
});

describe('benchmark query observation', () => {
  it('does not expose query observation in normal sessions', () => {
    exposeBenchmarkQueryStatus(new QueryClient());
    expect(window.__eddoBenchmarkQueryStatus).toBeUndefined();
  });
  it('exposes counts without query keys or document contents', () => {
    sessionStorage.setItem('eddoBenchmark', 'true');
    const client = new QueryClient();
    client.setQueryData(['private-key'], { description: 'private data' });
    exposeBenchmarkQueryStatus(client);
    expect(window.__eddoBenchmarkQueryStatus?.()).toEqual({ fetching: 0, queryCount: 1 });
    client.clear();
  });
});
