/**
 * Dependency canvas theme for focused dependency graph mode.
 * Renders card-style todo nodes on a dotted canvas.
 */
import type { GraphTheme } from '../types';

import { DependencyCanvasBackground } from './background';
import { DependencyCanvasEdge } from './edge';
import { dependencyCanvasLegendEdges, dependencyCanvasLegendNodes } from './legend';
import {
  DependencyCanvasFileNode,
  DependencyCanvasMetadataNode,
  DependencyCanvasTodoNode,
  DependencyCanvasUserNode,
} from './nodes';

/** Controls styling for dependency canvas theme */
const CONTROLS_CLASS =
  '!border-slate-300 !bg-white/95 !shadow-lg dark:!border-slate-700 dark:!bg-slate-900/95 ' +
  '[&>button]:!border-slate-200 [&>button]:!bg-slate-50 [&>button]:!fill-slate-600 ' +
  'dark:[&>button]:!border-slate-700 dark:[&>button]:!bg-slate-800 dark:[&>button]:!fill-slate-300 ' +
  '[&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-slate-700';

/** Dependency canvas theme configuration */
export const dependencyCanvasTheme: GraphTheme = {
  id: 'dependency_canvas',
  name: 'Dependency Canvas',
  description: 'Card-based dependency map inspired by business impact canvases.',

  nodes: {
    TodoNode: DependencyCanvasTodoNode,
    FileNode: DependencyCanvasFileNode,
    MetadataNode: DependencyCanvasMetadataNode,
    UserNode: DependencyCanvasUserNode,
  },

  Edge: DependencyCanvasEdge,
  Background: DependencyCanvasBackground,

  legend: {
    nodes: dependencyCanvasLegendNodes,
    edges: dependencyCanvasLegendEdges,
  },

  controlsClassName: CONTROLS_CLASS,
  classPrefix: 'theme-dependency-canvas',
  layout: 'elk',
};
