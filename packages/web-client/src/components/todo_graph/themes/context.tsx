/**
 * Theme context provider for graph view.
 * Manages current theme selection and persistence.
 */
import { createContext, type FC, type ReactNode, useCallback, useContext, useState } from 'react';

import { DEFAULT_THEME_ID, getTheme, type GraphTheme } from './index';

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
  /** Current theme */
  theme: GraphTheme;
  /** Current theme ID */
  themeId: string;
  /** Set theme by ID */
  setThemeId: (id: string) => void;
}

const GraphThemeContext = createContext<GraphThemeContextValue | null>(null);

/** Provider props */
interface GraphThemeProviderProps {
  children: ReactNode;
  /** Override initial theme (for testing) */
  initialThemeId?: string;
}

/** Theme context provider */
export const GraphThemeProvider: FC<GraphThemeProviderProps> = ({
  children,
  initialThemeId = loadThemePreference(),
}) => {
  const [themeId, setThemeIdState] = useState(initialThemeId);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    saveThemePreference(id);
  }, []);

  const theme = getTheme(themeId);

  return (
    <GraphThemeContext.Provider value={{ theme, themeId, setThemeId }}>
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

/** Hook to get current theme only */
export const useCurrentTheme = (): GraphTheme => useGraphTheme().theme;
