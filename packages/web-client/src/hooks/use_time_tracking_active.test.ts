import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePouchDb } from '../pouch_db';
import { useTimeTrackingActive } from './use_time_tracking_active';

// Mock the usePouchDb hook
vi.mock('../pouch_db', () => ({
  usePouchDb: vi.fn(),
}));

describe('useTimeTrackingActive', () => {
  let queryClient: QueryClient;
  let mockSafeDb: {
    safeQuery: ReturnType<typeof vi.fn>;
    safeFind: ReturnType<typeof vi.fn>;
    safeGet: ReturnType<typeof vi.fn>;
    safePut: ReturnType<typeof vi.fn>;
    safeRemove: ReturnType<typeof vi.fn>;
    safeAllDocs: ReturnType<typeof vi.fn>;
    safeBulkDocs: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests
        },
      },
    });

    // Create mock safeDb with all required methods
    mockSafeDb = {
      safeQuery: vi.fn(),
      safeFind: vi.fn(),
      safeGet: vi.fn(),
      safePut: vi.fn(),
      safeRemove: vi.fn(),
      safeAllDocs: vi.fn(),
      safeBulkDocs: vi.fn(),
    };

    // Mock usePouchDb to return our mock safeDb
    vi.mocked(usePouchDb).mockReturnValue({
      safeDb: mockSafeDb as never,
      rawDb: null as never,
      changes: vi.fn() as never,
      sync: null as never,
      healthMonitor: null as never,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('should return expected data structure (array of IDs)', async () => {
    // safeFind returns todos, hook filters for active ones with null end time
    const mockTodos = [
      { _id: 'todo-1', active: { '2025-01-01T10:00:00Z': null } },
      { _id: 'todo-2', active: { '2025-01-01T11:00:00Z': null } },
      { _id: 'todo-3', active: { '2025-01-01T12:00:00Z': null } },
    ];

    mockSafeDb.safeFind.mockResolvedValue(mockTodos);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(['todo-1', 'todo-2', 'todo-3']);
  });

  it('should respect enabled parameter when false', () => {
    const { result } = renderHook(() => useTimeTrackingActive({ enabled: false }), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSafeDb.safeFind).not.toHaveBeenCalled();
  });

  it('should respect enabled parameter when true', async () => {
    mockSafeDb.safeFind.mockResolvedValue([
      { _id: 'todo-1', active: { '2025-01-01T10:00:00Z': null } },
    ]);

    const { result } = renderHook(() => useTimeTrackingActive({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSafeDb.safeFind).toHaveBeenCalled();
    expect(result.current.data).toEqual(['todo-1']);
  });

  it('should use correct query key structure', async () => {
    mockSafeDb.safeFind.mockResolvedValue([]);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check that the query is cached with the correct key
    const cache = queryClient.getQueryCache();
    const queries = cache.findAll({
      queryKey: ['todos', 'byTimeTrackingActive'],
    });

    expect(queries.length).toBe(1);
  });

  it('should call safeFind with correct parameters', async () => {
    mockSafeDb.safeFind.mockResolvedValue([]);

    renderHook(() => useTimeTrackingActive(), { wrapper });

    await waitFor(() =>
      expect(mockSafeDb.safeFind).toHaveBeenCalledWith({
        version: 'alpha3',
        active: { $exists: true, $ne: {} },
      }),
    );
  });

  it('should return empty array when no active time tracking', async () => {
    mockSafeDb.safeFind.mockResolvedValue([]);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('should handle single active time tracking entry', async () => {
    mockSafeDb.safeFind.mockResolvedValue([
      { _id: 'single-todo', active: { '2025-01-01T10:00:00Z': null } },
    ]);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(['single-todo']);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Database error');
    mockSafeDb.safeFind.mockRejectedValue(error);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
  });

  it('should not query when safeDb is null', () => {
    vi.mocked(usePouchDb).mockReturnValue({
      safeDb: null as never,
      rawDb: null as never,
      changes: vi.fn() as never,
      sync: null as never,
      healthMonitor: null as never,
    });

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSafeDb.safeFind).not.toHaveBeenCalled();
  });

  it('should provide loading state', () => {
    mockSafeDb.safeFind.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should filter out todos without active null end time', async () => {
    // Mix of active (null end time) and inactive (completed) time entries
    const mockTodos = [
      { _id: 'todo-active', active: { '2025-01-01T10:00:00Z': null } },
      { _id: 'todo-completed', active: { '2025-01-01T10:00:00Z': '2025-01-01T11:00:00Z' } },
      {
        _id: 'todo-mixed',
        active: { '2025-01-01T10:00:00Z': '2025-01-01T11:00:00Z', '2025-01-01T12:00:00Z': null },
      },
    ];

    mockSafeDb.safeFind.mockResolvedValue(mockTodos);

    const { result } = renderHook(() => useTimeTrackingActive(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Only todos with at least one null end time should be returned
    expect(result.current.data).toEqual(['todo-active', 'todo-mixed']);
  });
});
