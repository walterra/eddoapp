import { describe, expect, it } from 'vitest';

import { getCassettePath, hashRequest } from './cassette-helpers.js';

describe('cassette helpers', () => {
  it('returns namespaced cassette path for model-specific recordings', () => {
    const path = getCassettePath({
      cassettesDir: '/tmp/cassettes',
      testName: 'create todo workflow',
      namespace: 'openai/gpt-5.2',
    });

    expect(path).toBe('/tmp/cassettes/openai_gpt-5_2/create_todo_workflow.json');
  });

  it('normalizes bare dates in request hashes', () => {
    const firstHash = hashRequest('test-model', 'Stable prompt', [
      { role: 'user', content: 'Tool result: {"summary":"Recap data for 2026-06-18"}' },
    ]);
    const secondHash = hashRequest('test-model', 'Stable prompt', [
      { role: 'user', content: 'Tool result: {"summary":"Recap data for 2026-06-19"}' },
    ]);

    expect(firstHash).toBe(secondHash);
  });
});
