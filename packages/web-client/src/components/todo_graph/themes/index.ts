/**
 * Theme registry for graph view.
 * Central export point for all themes and theming utilities.
 */
import { defaultTheme } from './default';
import { rpg2Theme } from './rpg2';
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

/** Available themes registry */
export const themes: Record<string, GraphTheme> = {
  default: defaultTheme,
  rpg2: rpg2Theme,
};

/** Get theme by ID, falls back to default */
export const getTheme = (themeId: string): GraphTheme => themes[themeId] ?? defaultTheme;

/** List all available themes */
export const getAvailableThemes = (): GraphTheme[] => Object.values(themes);

/** Default theme ID */
export const DEFAULT_THEME_ID = 'default';
