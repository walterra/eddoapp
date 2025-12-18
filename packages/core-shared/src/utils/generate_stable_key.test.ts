import { describe, expect, it } from 'vitest';

import { generateStableKey } from './generate_stable_key';

describe('generateStableKey', () => {
  it('should create stable keys from multiple string parts', () => {
    expect(generateStableKey('work', '2025-06-18', 'task')).toBe('work-2025-06-18-task');
  });

  it('should handle null and undefined values by filtering them out', () => {
    expect(generateStableKey('work', null, 'task')).toBe('work-task');

    expect(generateStableKey('work', undefined, 'task')).toBe('work-task');
  });

  it('should handle mixed types (string, number)', () => {
    expect(generateStableKey('todo', 123, 'completed')).toBe('todo-123-completed');
  });

  it('should handle empty input', () => {
    expect(generateStableKey()).toBe('');
  });

  it('should handle all null/undefined values', () => {
    expect(generateStableKey(null, undefined, null)).toBe('');
  });

  it('should convert numbers to strings', () => {
    expect(generateStableKey(42, 'test', 99)).toBe('42-test-99');
  });

  it('should be deterministic - same inputs produce same outputs', () => {
    const inputs = ['context', '2025-06-20', 'title'];
    const key1 = generateStableKey(...inputs);
    const key2 = generateStableKey(...inputs);

    expect(key1).toBe(key2);
    expect(key1).toBe('context-2025-06-20-title');
  });
});
