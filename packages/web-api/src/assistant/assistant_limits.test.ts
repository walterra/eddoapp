import { describe, expect, it } from 'vitest';
import { createAssistantLimits } from './assistant_limits';

describe('assistant request limits', () => {
  it('separates accounts and restores request budgets after the window expires', () => {
    let now = 0;
    const limits = createAssistantLimits(() => now);
    for (let index = 0; index < 10; index += 1) limits.consume('alice', true);
    expect(() => limits.consume('alice', true)).toThrow('rate_limited');
    expect(() => limits.consume('bob', true)).not.toThrow();
    expect(() => limits.consume('alice', false)).not.toThrow();
    now = 60_001;
    expect(() => limits.consume('alice', true)).not.toThrow();
  });

  it('releases stream capacity exactly once and enforces the global bound', () => {
    const limits = createAssistantLimits();
    const first = limits.acquireStream('alice');
    const second = limits.acquireStream('alice');
    expect(() => limits.acquireStream('alice')).toThrow('rate_limited');
    first();
    first();
    second();
    const releases = Array.from({ length: 100 }, (_, index) =>
      limits.acquireStream(`user-${index}`),
    );
    expect(() => limits.acquireStream('another')).toThrow('rate_limited');
    for (const release of releases) release();
    expect(() => limits.acquireStream('alice')()).not.toThrow();
  });
});
