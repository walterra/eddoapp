/**
 * Theme registry for graph view.
 * Central export point for all themes and theming utilities.
 * Themes are lazy-loaded to reduce initial bundle size.
 */
import type { GraphTheme } from './types';

export type {
  GraphTheme,
  LayoutAlgorithm,
  LegendEdgeItem,
  LegendNodeItem,
  NodeStyle,
  ThemedBackgroundProps,
  ThemedEdgeProps,
  ThemedFileNodeProps,
  ThemedMetadataNodeProps,
  ThemedTodoNodeProps,
  ThemedUserNodeProps,
  ThemeIcon,
} from './types';

/** Theme metadata for UI (available before theme loads) */
export interface ThemeMeta {
  id: string;
  name: string;
  description: string;
}

/** Theme loaders - lazy load theme modules */
const themeLoaders: Record<string, () => Promise<{ default: GraphTheme } | GraphTheme>> = {
  default: () => import('./default').then((m) => m.defaultTheme),
  rpg2: () => import('./rpg2').then((m) => m.rpg2Theme),
};

/** Theme metadata (available synchronously for theme selector UI) */
export const themeMetas: ThemeMeta[] = [
  { id: 'default', name: 'Default', description: 'Clean, professional look' },
  { id: 'rpg2', name: 'Village', description: 'Colorful cartoon village' },
];

/** Cache for loaded themes */
const themeCache = new Map<string, GraphTheme>();

/** Load a theme by ID (async) */
export const loadTheme = async (themeId: string): Promise<GraphTheme> => {
  // Check cache first
  const cached = themeCache.get(themeId);
  if (cached) return cached;

  // Load theme module
  const loader = themeLoaders[themeId] ?? themeLoaders.default;
  const theme = await loader();

  // Handle both default export and direct export
  const resolvedTheme = 'default' in theme ? (theme as { default: GraphTheme }).default : theme;
  themeCache.set(themeId, resolvedTheme as GraphTheme);
  return resolvedTheme as GraphTheme;
};

/** Check if theme is already loaded (cached) */
export const isThemeLoaded = (themeId: string): boolean => themeCache.has(themeId);

/** Get cached theme (returns undefined if not loaded) */
export const getCachedTheme = (themeId: string): GraphTheme | undefined => themeCache.get(themeId);

/** Preload a theme (useful for hover states) */
export const preloadTheme = (themeId: string): void => {
  if (!isThemeLoaded(themeId)) {
    loadTheme(themeId).catch(() => {
      /* ignore preload errors */
    });
  }
};

/** Get available theme IDs */
export const getAvailableThemeIds = (): string[] => Object.keys(themeLoaders);

/** Get available themes metadata (for selector UI) */
export const getAvailableThemes = (): ThemeMeta[] => themeMetas;

/** Default theme ID */
export const DEFAULT_THEME_ID = 'default';

// Backwards compatibility: Synchronous getTheme for existing code
// This will return the cached theme or a placeholder that loads async
// Note: New code should use loadTheme() instead
let defaultThemePromise: Promise<GraphTheme> | null = null;

/** @deprecated Use loadTheme() instead for async theme loading */
export const getTheme = (themeId: string): GraphTheme => {
  const cached = themeCache.get(themeId);
  if (cached) return cached;

  // Trigger async load but return cached default or throw
  loadTheme(themeId).catch(() => {});

  // Return default if available
  const defaultCached = themeCache.get('default');
  if (defaultCached) return defaultCached;

  // Preload default theme for next access
  if (!defaultThemePromise) {
    defaultThemePromise = loadTheme('default');
  }

  throw new Error(`Theme "${themeId}" not loaded. Use loadTheme() for async loading.`);
};
