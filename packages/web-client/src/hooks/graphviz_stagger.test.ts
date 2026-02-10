import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { applyGraphvizColumnStaggering } from './graphviz_stagger';

interface CreateNodeOptions {
  id: string;
  x: number;
  y: number;
}

/** Create a minimal todo node for stagger tests. */
const createNode = ({ id, x, y }: CreateNodeOptions): Node => ({
  id,
  type: 'todoNode',
  data: {
    showActions: true,
  },
  position: { x, y },
});

describe('applyGraphvizColumnStaggering', () => {
  it('keeps sparse columns unchanged', () => {
    const nodes = [
      createNode({ id: 'a', x: 100, y: 100 }),
      createNode({ id: 'b', x: 100, y: 260 }),
      createNode({ id: 'c', x: 100, y: 420 }),
    ];

    const result = applyGraphvizColumnStaggering(nodes);

    expect(result.map((node) => node.position.x)).toEqual([100, 100, 100]);
  });

  it('applies deterministic alternating offsets for dense vertical columns', () => {
    const nodes = [
      createNode({ id: 'a', x: 100, y: 100 }),
      createNode({ id: 'b', x: 100, y: 220 }),
      createNode({ id: 'c', x: 100, y: 340 }),
      createNode({ id: 'd', x: 100, y: 460 }),
      createNode({ id: 'e', x: 100, y: 580 }),
    ];

    const result = applyGraphvizColumnStaggering(nodes);

    expect(result.map((node) => node.position.x)).toEqual([100, 108, 92, 116, 84]);
  });

  it('staggeres each dense column independently', () => {
    const nodes = [
      createNode({ id: 'a1', x: 0, y: 100 }),
      createNode({ id: 'a2', x: 0, y: 220 }),
      createNode({ id: 'a3', x: 0, y: 340 }),
      createNode({ id: 'a4', x: 0, y: 460 }),
      createNode({ id: 'b1', x: 320, y: 120 }),
      createNode({ id: 'b2', x: 320, y: 240 }),
      createNode({ id: 'b3', x: 320, y: 360 }),
      createNode({ id: 'b4', x: 320, y: 480 }),
    ];

    const result = applyGraphvizColumnStaggering(nodes);

    expect(result.map((node) => node.position.x)).toEqual([0, 8, -8, 16, 320, 328, 312, 336]);
  });
});
