import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  buildGraphvizDotLayoutGraph,
  mapGraphvizPositionsToNodes,
  type GraphvizLayoutResult,
} from './graphviz_layout_helpers';

/** Create a minimal React Flow node for layout tests. */
const createNode = (id: string): Node => ({
  id,
  type: 'todoNode',
  position: { x: 0, y: 0 },
  data: {},
});

/** Create a minimal React Flow edge for layout tests. */
const createEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe('buildGraphvizDotLayoutGraph', () => {
  it('adds stronger constraints to parent edges and leveling to blocked edges', () => {
    const dot = buildGraphvizDotLayoutGraph({
      nodes: [createNode('root'), createNode('child'), createNode('blocked')],
      edges: [
        createEdge('parent:root-child', 'root', 'child'),
        createEdge('blocked:child-blocked', 'child', 'blocked'),
      ],
      rootNodeId: 'root',
      width: 1600,
      height: 800,
    });

    expect(dot).toContain('rankdir=LR;');
    expect(dot).toContain('"root" -> "child" [weight=8 minlen=1 constraint=true];');
    expect(dot).toContain('"child" -> "blocked" [weight=3 minlen=3 constraint=true style=dashed];');
  });

  it('adds invisible fanout edges for dense child lists in horizontal layout', () => {
    const childIds = Array.from({ length: 12 }, (_, index) => `c${String(index).padStart(2, '0')}`);
    const nodes = [createNode('root'), createNode('parent'), ...childIds.map(createNode)];
    const edges = [
      createEdge('parent:root-parent', 'root', 'parent'),
      ...childIds.map((childId) => createEdge(`parent:parent-${childId}`, 'parent', childId)),
    ];

    const dot = buildGraphvizDotLayoutGraph({
      nodes,
      edges,
      rootNodeId: 'root',
      width: 1600,
      height: 800,
    });

    expect(dot).toContain('"c00" -> "c06" [style=invis constraint=true weight=1 minlen=1];');
    expect(dot).toContain('"c05" -> "c11" [style=invis constraint=true weight=1 minlen=1];');
  });

  it('falls back to top-bottom rank direction for tall viewports', () => {
    const dot = buildGraphvizDotLayoutGraph({
      nodes: [createNode('root')],
      edges: [],
      rootNodeId: 'root',
      width: 600,
      height: 1200,
    });

    expect(dot).toContain('rankdir=TB;');
  });
});

describe('mapGraphvizPositionsToNodes', () => {
  it('converts graphviz center positions to top-left node positions', () => {
    const initialNodes = [createNode('a')];
    const layout: GraphvizLayoutResult = {
      objects: [{ name: 'a', pos: '100,200', width: '1', height: '2' }],
    };

    const result = mapGraphvizPositionsToNodes(initialNodes, layout);

    expect(result[0].position.x).toBeCloseTo(64);
    expect(result[0].position.y).toBeCloseTo(128);
  });

  it('keeps original position when graphviz does not return a node', () => {
    const initialNodes = [{ ...createNode('a'), position: { x: 20, y: 40 } }];
    const layout: GraphvizLayoutResult = { objects: [{ name: 'b', pos: '10,10' }] };

    const result = mapGraphvizPositionsToNodes(initialNodes, layout);

    expect(result[0].position).toEqual({ x: 20, y: 40 });
  });
});
