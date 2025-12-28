import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDelayedLoading } from './use_delayed_loading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not show loading immediately when isLoading becomes true', () => {
    const { result } = renderHook(() => useDelayedLoading(true));

    expect(result.current).toBe(false);
  });

  it('should show loading after delay when isLoading is true', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 200));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(true);
  });

  it('should not show loading if isLoading becomes false before delay', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 200), {
      initialProps: { isLoading: true },
    });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(false);

    // Loading finishes before delay
    rerender({ isLoading: false });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(false);
  });

  it('should hide loading immediately when isLoading becomes false', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 200), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(true);

    rerender({ isLoading: false });

    expect(result.current).toBe(false);
  });

  it('should use default delay of 200ms', () => {
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe(true);
  });

  it('should respect custom delay', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 500));

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe(true);
  });
});
