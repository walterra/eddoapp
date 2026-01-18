/**
 * RPG2 theme for the graph view.
 * Colorful cartoon village style with isometric grid layout.
 */
import type { GraphTheme } from '../types';

import { Rpg2Background } from './background';
import { Rpg2Edge } from './edge';
import { rpg2LegendEdges, rpg2LegendNodes, Rpg2SplitTodoIcon } from './legend';
import { Rpg2FileNode, Rpg2MetadataNode, Rpg2TodoNode, Rpg2UserNode } from './nodes';

/** Controls styling for RPG2 theme */
const CONTROLS_CLASS =
  '!border-green-600 !bg-green-100 !shadow-lg dark:!border-green-800 dark:!bg-green-950 ' +
  '[&>button]:!border-green-500 [&>button]:!bg-green-50 [&>button]:!fill-green-800 ' +
  'dark:[&>button]:!border-green-700 dark:[&>button]:!bg-green-900 dark:[&>button]:!fill-green-200 ' +
  '[&>button:hover]:!bg-green-200 dark:[&>button:hover]:!bg-green-800';

/** RPG2 theme configuration */
export const rpg2Theme: GraphTheme = {
  id: 'rpg2',
  name: 'Village',
  description: 'Colorful cartoon village with isometric grid layout.',

  nodes: {
    TodoNode: Rpg2TodoNode,
    FileNode: Rpg2FileNode,
    MetadataNode: Rpg2MetadataNode,
    UserNode: Rpg2UserNode,
  },

  Edge: Rpg2Edge,
  Background: Rpg2Background,

  legend: {
    nodes: rpg2LegendNodes,
    edges: rpg2LegendEdges,
    SplitTodoIcon: Rpg2SplitTodoIcon,
  },

  controlsClassName: CONTROLS_CLASS,
  classPrefix: 'theme-rpg2',

  // Use deterministic isometric grid layout
  layout: 'isometric',

  // Lock nodes in place for consistent village layout
  nodesDraggable: false,
};
