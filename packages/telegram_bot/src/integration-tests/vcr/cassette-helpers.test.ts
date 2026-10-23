import { describe, expect, it } from 'vitest';

import { createInteractionRecord, getCassettePath, hashRequest } from './cassette-helpers.js';

describe('cassette helpers', () => {
  it('shortens system snapshots while retaining full user/tool messages and source data', () => {
    const messages = [
      {
        role: 'system',
        content: JSON.stringify({ sections: { eddo: 'Full system instructions '.repeat(200) } }),
      },
      { role: 'user', content: 'User request '.repeat(200) },
      { role: 'toolResult', content: JSON.stringify({ tasks: ['Task details '.repeat(200)] }) },
    ];
    const original = structuredClone(messages);
    const systemPrompt = 'Full prompt '.repeat(200);
    const requestHash = hashRequest('test-model', systemPrompt, messages);
    const record = createInteractionRecord({
      requestHash,
      model: 'test-model',
      systemPrompt,
      messages,
      response: 'Complete response',
      responseTimeMs: 10,
    });
    expect(record.request.messages[0]).toEqual({
      role: 'system',
      content: `${original[0].content.slice(0, 200)}...`,
    });
    expect(record.request.messages.slice(1)).toEqual(original.slice(1));
    expect(record.request.systemPrompt).toBe(systemPrompt);
    expect(record.response).toBe('Complete response');
    expect(record.requestHash).toBe(requestHash);
    expect(messages).toEqual(original);
    expect(record.requestHash).toBe(hashRequest('test-model', systemPrompt, messages));
  });

  it('preserves short system snapshots without adding an ellipsis', () => {
    const record = createInteractionRecord({
      requestHash: 'hash',
      model: 'test-model',
      systemPrompt: 'Prompt',
      messages: [{ role: 'system', content: 'Short instructions' }],
      response: 'Done',
      responseTimeMs: 1,
    });
    expect(record.request.messages[0].content).toBe('Short instructions');
  });

  it('returns namespaced cassette path for model-specific recordings', () => {
    const path = getCassettePath({
      cassettesDir: '/tmp/cassettes',
      testName: 'create todo workflow',
      namespace: 'openai/gpt-5.2',
    });

    expect(path).toBe('/tmp/cassettes/openai_gpt-5_2/create_todo_workflow.json');
  });

  it('reuses the original Anthropic model directory for native replacements', () => {
    expect(
      getCassettePath({
        cassettesDir: '/tmp/cassettes',
        testName: 'scenario',
        namespace: 'anthropic/claude-sonnet-4-5-20250929',
      }),
    ).toBe('/tmp/cassettes/claude-sonnet-4-5-20250929/scenario.json');
  });

  it.each([false, true])('normalizes tool weekdays with nested JSON=%s', (nested) => {
    const hash = (weekday: string): string => {
      const result = { metadata: { weekday } };
      const content = nested
        ? JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(result) }] })
        : JSON.stringify(result);
      return hashRequest('test-model', 'Stable prompt', [{ role: 'toolResult', content }]);
    };
    expect(hash('Wednesday')).toBe(hash('Friday'));
  });

  it('preserves weekday references in user requests', () => {
    const hash = (weekday: string): string =>
      hashRequest('test-model', 'Stable prompt', [
        { role: 'user', content: JSON.stringify({ metadata: { weekday } }) },
      ]);
    expect(hash('Wednesday')).not.toBe(hash('Friday'));
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
