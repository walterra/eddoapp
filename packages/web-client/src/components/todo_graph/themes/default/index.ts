/**
 * Default theme for the graph view.
 * Clean, professional look with rounded rectangles and neutral color palette.
 */
import type { GraphTheme } from '../types';

import { DefaultBackground } from './background';
import { DefaultEdge } from './edge';
import { defaultLegendEdges, defaultLegendNodes, DefaultSplitTodoIcon } from './legend';
import { DefaultFileNode, DefaultMetadataNode, DefaultTodoNode, DefaultUserNode } from './nodes';

/** Controls styling for light/dark mode */
const CONTROLS_CLASS =
  '!border-neutral-300 !bg-white !shadow-lg dark:!border-neutral-700 dark:!bg-neutral-800 ' +
  '[&>button]:!border-neutral-200 [&>button]:!bg-neutral-50 [&>button]:!fill-neutral-600 ' +
  'dark:[&>button]:!border-neutral-600 dark:[&>button]:!bg-neutral-700 dark:[&>button]:!fill-neutral-300 ' +
  '[&>button:hover]:!bg-neutral-100 dark:[&>button:hover]:!bg-neutral-600';

/** Default theme configuration */
export const defaultTheme: GraphTheme = {
  id: 'default',
  name: 'Default',
  description: 'Clean, professional look with rounded rectangles and neutral color palette.',

  nodes: {
    TodoNode: DefaultTodoNode,
    FileNode: DefaultFileNode,
    MetadataNode: DefaultMetadataNode,
    UserNode: DefaultUserNode,
  },

  Edge: DefaultEdge,
  Background: DefaultBackground,

  legend: {
    nodes: defaultLegendNodes,
    edges: defaultLegendEdges,
    SplitTodoIcon: DefaultSplitTodoIcon,
  },

  controlsClassName: CONTROLS_CLASS,
  classPrefix: 'theme-default',
};
