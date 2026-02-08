/**
 * Theme context provider for graph view.
 * Manages current theme selection, async loading, and persistence.
 */
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  DEFAULT_THEME_ID,
  getCachedTheme,
  type GraphTheme,
  loadTheme,
  preloadTheme,
} from './index';

/** Local storage key for theme preference */
const THEME_STORAGE_KEY = 'eddo-graph-theme';

/** Load theme preference from localStorage */
const loadThemePreference = (): string => {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
};

/** Save theme preference to localStorage */
const saveThemePreference = (themeId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }
};

/** Theme context value */
interface GraphThemeContextValue {
  theme: GraphTheme | null;
  themeId: string;
  isLoading: boolean;
  setThemeId: (id: string) => void;
  preloadTheme: (id: string) => void;
}

const GraphThemeContext = createContext<GraphThemeContextValue | null>(null);

/** Provider props */
interface GraphThemeProviderProps {
  children: ReactNode;
  initialThemeId?: string;
  forcedThemeId?: string;
}

/** Hook for async theme loading */
const useThemeLoader = (themeId: string) => {
  const [theme, setTheme] = useState<GraphTheme | null>(() => getCachedTheme(themeId) ?? null);
  const [isLoading, setIsLoading] = useState(!getCachedTheme(themeId));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cached = getCachedTheme(themeId);
      if (cached) {
        setTheme(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const loadedTheme = await loadTheme(themeId);
        if (!cancelled) {
          setTheme(loadedTheme);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          const fallback = await loadTheme(DEFAULT_THEME_ID);
          setTheme(fallback);
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [themeId]);

  return { theme, isLoading };
};

/** Theme context provider */
export const GraphThemeProvider: FC<GraphThemeProviderProps> = ({
  children,
  initialThemeId = loadThemePreference(),
  forcedThemeId,
}) => {
  const [themeId, setThemeIdState] = useState(forcedThemeId ?? initialThemeId);
  const activeThemeId = forcedThemeId ?? themeId;
  const { theme, isLoading } = useThemeLoader(activeThemeId);

  useEffect(() => {
    if (!forcedThemeId) {
      return;
    }

    setThemeIdState(forcedThemeId);
  }, [forcedThemeId]);

  const setThemeId = useCallback(
    (id: string) => {
      if (forcedThemeId) {
        return;
      }

      setThemeIdState(id);
      saveThemePreference(id);
    },
    [forcedThemeId],
  );

  const handlePreload = useCallback((id: string) => {
    preloadTheme(id);
  }, []);

  return (
    <GraphThemeContext.Provider
      value={{
        theme,
        themeId: activeThemeId,
        isLoading,
        setThemeId,
        preloadTheme: handlePreload,
      }}
    >
      {children}
    </GraphThemeContext.Provider>
  );
};

/** Hook to access theme context */
export const useGraphTheme = (): GraphThemeContextValue => {
  const context = useContext(GraphThemeContext);
  if (!context) {
    throw new Error('useGraphTheme must be used within a GraphThemeProvider');
  }
  return context;
};

/** Hook to get current theme only (throws if not loaded) */
export const useCurrentTheme = (): GraphTheme => {
  const { theme } = useGraphTheme();
  if (!theme) {
    throw new Error('Theme not loaded yet. Check isLoading state first.');
  }
  return theme;
};

/** Hook to safely get current theme (returns null if loading) */
export const useCurrentThemeSafe = (): GraphTheme | null => useGraphTheme().theme;
