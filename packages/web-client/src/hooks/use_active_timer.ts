import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing active timer state with proper cleanup
 *
 * @param isActive - Whether the timer should be running
 * @param interval - Timer interval in milliseconds (default: 1000)
 * @returns Object containing counter value and reset function
 */
export function useActiveTimer(isActive: boolean, interval: number = 1000) {
  const [counter, setCounter] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (intervalRef.current) return; // Prevent multiple timers

    intervalRef.current = setInterval(() => {
      setCounter((prev) => prev + 1);
    }, interval);
  }, [interval]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setCounter(0);
  }, [stopTimer]);

  useEffect(() => {
    if (isActive) {
      startTimer();
    } else {
      resetTimer();
    }

    return stopTimer; // Cleanup on unmount
  }, [isActive, startTimer, resetTimer, stopTimer]);

  return { counter, resetTimer };
}
