import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { buildPrioritizedRadialTreeEdges } from './elk_radial_tree';

interface EdgeParams {
  id: string;
  source: string;
  target: string;
}

/** Create a minimal React Flow node for layout tests */
const createNode = (id: string): Node => ({
  id,
  data: {},
  position: { x: 0, y: 0 },
});

/** Create a minimal React Flow edge for layout tests */
const createEdge = (params: EdgeParams): Edge => ({
  id: params.id,
  source: params.source,
  target: params.target,
});

describe('buildPrioritizedRadialTreeEdges', () => {
  it('prefers blocked paths over parent-only paths', () => {
    const nodes = [createNode('root'), createNode('parent-child'), createNode('blocked-hop')];
    const edges = [
      createEdge({ id: 'parent:root-parent-child', source: 'root', target: 'parent-child' }),
      createEdge({ id: 'blocked:root-blocked-hop', source: 'root', target: 'blocked-hop' }),
      createEdge({
        id: 'blocked:blocked-hop-parent-child',
        source: 'blocked-hop',
        target: 'parent-child',
      }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'root');

    expect(result.some((edge) => edge.id === 'layout-tree:blocked-hop->parent-child')).toBe(true);
    expect(result.some((edge) => edge.id === 'layout-tree:root->parent-child')).toBe(false);
  });

  it('treats blockedBy edges as undirected for traversal', () => {
    const nodes = [createNode('blocker'), createNode('blocked')];
    const edges = [
      createEdge({ id: 'blocked:blocker-blocked', source: 'blocker', target: 'blocked' }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'blocked');

    expect(result).toEqual([
      {
        id: 'layout-tree:blocked->blocker',
        source: 'blocked',
        target: 'blocker',
      },
    ]);
  });

  it('uses parent-child path when no blocked path exists', () => {
    const nodes = [createNode('root'), createNode('a'), createNode('b')];
    const edges = [
      createEdge({ id: 'parent:root-a', source: 'root', target: 'a' }),
      createEdge({ id: 'parent:a-b', source: 'a', target: 'b' }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'root');

    expect(result.some((edge) => edge.id === 'layout-tree:root->a')).toBe(true);
    expect(result.some((edge) => edge.id === 'layout-tree:a->b')).toBe(true);
  });

  it('creates orphan edges for disconnected nodes', () => {
    const nodes = [createNode('root'), createNode('connected'), createNode('orphan')];
    const edges = [
      createEdge({ id: 'parent:root-connected', source: 'root', target: 'connected' }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'root');

    expect(result.some((edge) => edge.id === 'layout-tree:root->connected')).toBe(true);
    expect(result.some((edge) => edge.id === 'layout-orphan:root->orphan')).toBe(true);
  });

  it('ignores parent edges for todos that have blockedBy edges', () => {
    const nodes = [
      createNode('root'),
      createNode('parent'),
      createNode('blocker'),
      createNode('blocked-target'),
    ];
    const edges = [
      createEdge({ id: 'parent:root-parent', source: 'root', target: 'parent' }),
      createEdge({
        id: 'parent:parent-blocked-target',
        source: 'parent',
        target: 'blocked-target',
      }),
      createEdge({ id: 'blocked:root-blocker', source: 'root', target: 'blocker' }),
      createEdge({
        id: 'blocked:blocker-blocked-target',
        source: 'blocker',
        target: 'blocked-target',
      }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'root');

    expect(result.some((edge) => edge.id === 'layout-tree:parent->blocked-target')).toBe(false);
    expect(result.some((edge) => edge.id === 'layout-tree:blocker->blocked-target')).toBe(true);
  });

  it('breaks equal-distance blocked ties deterministically by predecessor id', () => {
    const nodes = [createNode('root'), createNode('a'), createNode('b'), createNode('target')];
    const edges = [
      createEdge({ id: 'blocked:root-a', source: 'root', target: 'a' }),
      createEdge({ id: 'blocked:root-b', source: 'root', target: 'b' }),
      createEdge({ id: 'blocked:a-target', source: 'a', target: 'target' }),
      createEdge({ id: 'blocked:b-target', source: 'b', target: 'target' }),
    ];

    const result = buildPrioritizedRadialTreeEdges(nodes, edges, 'root');

    expect(result.some((edge) => edge.id === 'layout-tree:a->target')).toBe(true);
    expect(result.some((edge) => edge.id === 'layout-tree:b->target')).toBe(false);
  });
});
