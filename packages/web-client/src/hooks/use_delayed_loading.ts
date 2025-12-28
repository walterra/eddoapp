import { useEffect, useState } from 'react';

/**
 * Delays showing a loading state to prevent flickering for fast operations.
 * Returns true only after the specified delay has passed while isLoading is true.
 *
 * @param isLoading - Current loading state
 * @param delay - Delay in milliseconds before showing loading (default: 200ms)
 * @returns Delayed loading state
 */
export function useDelayedLoading(isLoading: boolean, delay: number = 200): boolean {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [isLoading, delay]);

  return showLoading;
}
