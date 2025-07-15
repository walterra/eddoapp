import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useActiveTimer } from './use_active_timer';

// Mock timers
vi.useFakeTimers();

describe('useActiveTimer', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it('should start with counter at 0', () => {
    const { result } = renderHook(() => useActiveTimer(false));
    expect(result.current.counter).toBe(0);
  });

  it('should increment counter when active', () => {
    const { result } = renderHook(() => useActiveTimer(true));

    expect(result.current.counter).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.counter).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.counter).toBe(3);
  });

  it('should not increment counter when inactive', () => {
    const { result } = renderHook(() => useActiveTimer(false));

    expect(result.current.counter).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.counter).toBe(0);
  });

  it('should reset counter when changing from active to inactive', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useActiveTimer(active),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.counter).toBe(3);

    rerender({ active: false });

    expect(result.current.counter).toBe(0);
  });

  it('should start timer when changing from inactive to active', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useActiveTimer(active),
      { initialProps: { active: false } },
    );

    expect(result.current.counter).toBe(0);

    rerender({ active: true });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.counter).toBe(2);
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = renderHook(() => useActiveTimer(true));

    // Verify timer is running
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    // Verify cleanup was called
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should not create multiple timers on rerender', () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useActiveTimer(active),
      { initialProps: { active: true } },
    );

    expect(vi.getTimerCount()).toBe(1);

    // Rerender multiple times
    rerender({ active: true });
    rerender({ active: true });
    rerender({ active: true });

    // Should still only have one timer
    expect(vi.getTimerCount()).toBe(1);
  });

  it('should reset counter using resetTimer function', () => {
    const { result } = renderHook(() => useActiveTimer(true));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.counter).toBe(5);

    act(() => {
      result.current.resetTimer();
    });

    expect(result.current.counter).toBe(0);
  });

  it('should use custom interval', () => {
    const { result } = renderHook(() => useActiveTimer(true, 500));

    expect(result.current.counter).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.counter).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.counter).toBe(3);
  });

  it('should handle interval changes correctly', () => {
    const { result, rerender } = renderHook(
      ({ interval }: { interval: number }) => useActiveTimer(true, interval),
      { initialProps: { interval: 1000 } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.counter).toBe(1);

    // Change interval
    rerender({ interval: 500 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.counter).toBe(2);
  });

  it('should handle rapid state changes correctly', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useActiveTimer(active),
      { initialProps: { active: true } },
    );

    // Rapid on/off changes
    rerender({ active: false });
    rerender({ active: true });
    rerender({ active: false });
    rerender({ active: true });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.counter).toBe(2);
  });
});
