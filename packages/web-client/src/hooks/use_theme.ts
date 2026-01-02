import { useCallback, useEffect, useMemo, useState } from 'react';

import { useProfile } from './use_profile';
import type { ThemePreference } from './use_profile_types';
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  type ResolvedTheme,
  resolveTheme,
  storeTheme,
} from './use_theme_helpers';

export { initializeTheme, type ResolvedTheme } from './use_theme_helpers';

export interface UseThemeReturn {
  /** User's theme preference (system/light/dark) */
  theme: ThemePreference;
  /** Actual applied theme (light/dark) */
  resolvedTheme: ResolvedTheme;
  /** Whether theme is being loaded */
  isLoading: boolean;
  /** Set theme preference */
  setTheme: (theme: ThemePreference) => Promise<{ success: boolean; error?: string }>;
}

/** Listens for system theme changes and updates state */
function useSystemThemeListener(setSystemTheme: (theme: ResolvedTheme) => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setSystemTheme]);
}

/**
 * Hook for managing UI theme with persistence
 * @returns Theme state and setter
 */
export const useTheme = (): UseThemeReturn => {
  const { profile, isLoading: profileLoading, updatePreferences } = useProfile();
  const isAuthenticated = !!profile;

  const initialTheme = useMemo<ThemePreference>(() => {
    return profile?.preferences?.theme ?? getStoredTheme();
  }, [profile?.preferences?.theme]);

  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    return theme === 'system' ? systemTheme : theme;
  }, [theme, systemTheme]);

  useEffect(() => {
    if (profile?.preferences?.theme) setThemeState(profile.preferences.theme);
  }, [profile?.preferences?.theme]);

  useSystemThemeListener(setSystemTheme);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    async (newTheme: ThemePreference): Promise<{ success: boolean; error?: string }> => {
      setThemeState(newTheme);
      storeTheme(newTheme);
      applyTheme(resolveTheme(newTheme));
      if (isAuthenticated) return await updatePreferences({ theme: newTheme });
      return { success: true };
    },
    [isAuthenticated, updatePreferences],
  );

  return { theme, resolvedTheme, isLoading: profileLoading, setTheme };
};
