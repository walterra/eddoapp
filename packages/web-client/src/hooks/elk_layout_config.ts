/**
 * ELK layout options and node sizing helpers.
 */
import type { Node } from '@xyflow/react';

type ElkDirection = 'RIGHT' | 'DOWN';
export type ElkLayoutAlgorithm = 'layered' | 'radial';

interface NodeDimensions {
  width: number;
  height: number;
}

interface TodoLayoutData {
  showActions?: boolean;
}

/** Resolve layered direction from viewport aspect ratio */
const getLayeredDirection = (width: number, height: number): ElkDirection =>
  width / Math.max(height, 1) >= 1.45 ? 'DOWN' : 'RIGHT';

/** Build ELK layered options */
const getLayeredOptions = (
  width: number,
  height: number,
  isDependencyLayout: boolean,
): Record<string, string> => {
  if (isDependencyLayout) {
    return {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '80',
      'org.eclipse.elk.layered.wrapping.strategy': 'MULTI_EDGE',
    };
  }

  const direction = getLayeredDirection(width, height);

  if (direction === 'DOWN') {
    return {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.spacing.edgeNodeBetweenLayers': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '56',
    };
  }

  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.spacing.edgeNodeBetweenLayers': '42',
    'elk.layered.spacing.nodeNodeBetweenLayers': '136',
    'elk.spacing.nodeNode': '44',
  };
};

/** Build ELK radial options */
const getRadialOptions = (): Record<string, string> => ({
  'elk.algorithm': 'org.eclipse.elk.radial',
  'org.eclipse.elk.radial.centerOnRoot': 'true',
  'org.eclipse.elk.radial.radius': '220',
  'org.eclipse.elk.radial.compactor': 'RADIAL_COMPACTION',
});

/** Build ELK options by algorithm */
export const getElkOptions = (
  width: number,
  height: number,
  algorithm: ElkLayoutAlgorithm,
  isDependencyLayout: boolean,
): Record<string, string> =>
  algorithm === 'radial'
    ? getRadialOptions()
    : getLayeredOptions(width, height, isDependencyLayout);

/** Identify dependency-mode todo nodes that render large cards */
const isDependencyTodoNode = (node: Node): boolean => {
  if (node.type !== 'todoNode') {
    return false;
  }

  const data = node.data as TodoLayoutData | undefined;
  return Boolean(data?.showActions);
};

/** Get layout dimensions for each node type */
export const getNodeDimensions = (node: Node): NodeDimensions => {
  if (isDependencyTodoNode(node)) {
    return { width: 248, height: 124 };
  }

  if (node.type === 'todoNode') {
    return { width: 72, height: 72 };
  }

  if (node.type === 'metadataNode') {
    return { width: 120, height: 52 };
  }

  if (node.type === 'userNode') {
    return { width: 64, height: 64 };
  }

  if (node.type === 'fileNode') {
    return { width: 56, height: 56 };
  }

  return { width: 80, height: 80 };
};
