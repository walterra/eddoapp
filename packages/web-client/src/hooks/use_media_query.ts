/**
 * Hook for matching media queries
 */
import { useEffect, useState } from 'react';

/**
 * Returns true when the media query matches.
 * @param query - CSS media query string
 * @returns Whether the query currently matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};
