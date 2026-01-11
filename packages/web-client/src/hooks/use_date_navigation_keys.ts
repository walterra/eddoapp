/**
 * Hook for keyboard navigation of date periods
 * Left arrow = previous period, Right arrow = next period
 */
import { useEffect } from 'react';

import type { TimeRange } from '../components/time_range_filter';

interface UseDateNavigationKeysOptions {
  /** Current time range setting */
  timeRange: TimeRange;
  /** Callback to navigate to previous/next period */
  onNavigate: (direction: 'prev' | 'next') => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Check if the event target is an input element where typing should be allowed
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

/**
 * Hook that enables left/right arrow key navigation for date periods.
 *
 * - ArrowLeft: Navigate to previous period
 * - ArrowRight: Navigate to next period
 *
 * Navigation is disabled when:
 * - User is typing in an input/textarea
 * - Modifier keys (Ctrl, Alt, Meta) are pressed
 * - Time range is 'all-time' (no period navigation makes sense)
 */
export function useDateNavigationKeys({
  timeRange,
  onNavigate,
  enabled = true,
}: UseDateNavigationKeysOptions): void {
  useEffect(() => {
    // Don't attach listener if disabled or if time range doesn't support navigation
    if (!enabled || timeRange.type === 'all-time') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing
      if (isTypingTarget(event.target)) return;

      // Ignore if modifier keys are pressed (allow browser shortcuts)
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigate('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate('next');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [timeRange.type, onNavigate, enabled]);
}
