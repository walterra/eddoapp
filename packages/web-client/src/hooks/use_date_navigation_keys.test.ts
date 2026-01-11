import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimeRange } from '../components/time_range_filter';

import { useDateNavigationKeys } from './use_date_navigation_keys';

describe('useDateNavigationKeys', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    mockOnNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dayTimeRange: TimeRange = { type: 'current-day' };
  const allTimeRange: TimeRange = { type: 'all-time' };

  const fireKeyEvent = (key: string, options: Partial<KeyboardEvent> = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...options,
    });
    document.dispatchEvent(event);
  };

  it('should call onNavigate with "prev" when ArrowLeft is pressed', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    fireKeyEvent('ArrowLeft');

    expect(mockOnNavigate).toHaveBeenCalledWith('prev');
    expect(mockOnNavigate).toHaveBeenCalledTimes(1);
  });

  it('should call onNavigate with "next" when ArrowRight is pressed', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    fireKeyEvent('ArrowRight');

    expect(mockOnNavigate).toHaveBeenCalledWith('next');
    expect(mockOnNavigate).toHaveBeenCalledTimes(1);
  });

  it('should not navigate when time range is all-time', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: allTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    fireKeyEvent('ArrowLeft');
    fireKeyEvent('ArrowRight');

    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when disabled', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
        enabled: false,
      }),
    );

    fireKeyEvent('ArrowLeft');
    fireKeyEvent('ArrowRight');

    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when modifier keys are pressed', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    fireKeyEvent('ArrowLeft', { metaKey: true });
    fireKeyEvent('ArrowLeft', { ctrlKey: true });
    fireKeyEvent('ArrowLeft', { altKey: true });

    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when typing in an input', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    // Create an input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Dispatch event with input as target
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    document.dispatchEvent(event);

    expect(mockOnNavigate).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('should not navigate when typing in a textarea', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    document.dispatchEvent(event);

    expect(mockOnNavigate).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('should ignore other keys', () => {
    renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    fireKeyEvent('ArrowUp');
    fireKeyEvent('ArrowDown');
    fireKeyEvent('Enter');
    fireKeyEvent('a');

    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useDateNavigationKeys({
        timeRange: dayTimeRange,
        onNavigate: mockOnNavigate,
      }),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
