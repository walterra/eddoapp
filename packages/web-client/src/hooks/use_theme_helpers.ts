import type { ThemePreference } from './use_profile_types';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'eddo-theme';

/** Detects system color scheme preference */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Gets theme from localStorage for unauthenticated users */
export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/** Stores theme in localStorage */
export function storeTheme(theme: ThemePreference): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/** Applies theme class to document root */
export function applyTheme(resolvedTheme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolvedTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/** Resolves theme preference to actual theme */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

/**
 * Initializes theme on app load to prevent flash of wrong theme.
 * Call this before React hydration or in a blocking script.
 */
export function initializeTheme(): void {
  const theme = getStoredTheme();
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
}
