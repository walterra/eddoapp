import { describe, expect, it } from 'vitest';
import { readRecording } from './recording.js';

const user = { role: 'user', content: 'Create shopping task', timestamp: 1 };
const assistant = { role: 'assistant', content: [{ type: 'text', text: 'Created' }], timestamp: 2 };

function interaction(messages: unknown[], response: unknown = assistant) {
  return {
    request: {
      model: 'test/model',
      messages: messages.map((message) => ({
        role: (message as typeof user).role,
        content: JSON.stringify(message),
      })),
    },
    response: JSON.stringify({ format: 'pi-durable-assistant-v1', message: response }),
  };
}

function recording(interactions: unknown[]): string {
  return JSON.stringify({ testName: 'shopping', interactions });
}

describe('recording review input', () => {
  it('removes repeated history but keeps a repeated user request', () => {
    const text = recording([
      interaction([user]),
      interaction([user, assistant, { ...user, timestamp: 3 }]),
    ]);
    const result = readRecording('test.json', text);
    expect(result.events.map((event) => event.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(result.events.map((event) => event.id)).toEqual([
      'event-1',
      'event-2',
      'event-3',
      'event-4',
    ]);
    expect(result.events[2].source).toBe('request.messages[2]');
    expect(result.events[2].interaction).toBe(1);
    expect(result.sha256).toHaveLength(64);
  });

  it('preserves tool calls and results but removes reasoning and accounting', () => {
    const call = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'private' },
        { type: 'toolCall', id: 'call-1', name: 'createTodo', arguments: { title: 'Shopping' } },
      ],
      usage: { tokens: 10 },
    };
    const tool = {
      role: 'toolResult',
      toolName: 'createTodo',
      toolCallId: 'call-1',
      isError: false,
      content: [{ type: 'text', text: 'Created' }],
    };
    const result = readRecording(
      'test.json',
      recording([
        interaction([{ role: 'system', content: 'policy snapshot...' }, user], call),
        interaction([user, call, tool]),
      ]),
    );
    expect(result.events.map((event) => event.role)).toEqual([
      'user',
      'assistant',
      'toolResult',
      'assistant',
    ]);
    expect(JSON.stringify(result.events)).not.toContain('private');
    expect(JSON.stringify(result.events)).not.toContain('usage');
    expect(result.events[1].content).toContain('createTodo');
    expect(result.events[2].content).toContain('call-1');
  });

  it('rejects empty and legacy recordings before paid calls', () => {
    expect(() => readRecording('test.json', recording([]))).toThrow();
    const legacy = interaction([user]);
    legacy.response = 'TOOL_CALL: createTodo';
    expect(() => readRecording('test.json', recording([legacy]))).toThrow();
  });

  it('rejects mixed model recordings', () => {
    const second = interaction([user]);
    second.request.model = 'other/model';
    expect(() => readRecording('test.json', recording([interaction([user]), second]))).toThrow(
      'multiple subject models',
    );
  });
});
