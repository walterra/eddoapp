import { describe, expect, it } from 'vitest';

import { serializeError } from './logger.js';

describe('serializeError', () => {
  it('serializes string errors', () => {
    const result = serializeError('Something went wrong');

    expect(result).toEqual({
      'error.message': 'Something went wrong',
      'error.type': 'string',
    });
  });

  it('serializes Error objects', () => {
    const error = new Error('Test error');
    const result = serializeError(error);

    expect(result['error.message']).toBe('Test error');
    expect(result['error.type']).toBe('Error');
    expect(result['error.stack_trace']).toBeDefined();
  });

  it('serializes TypeError objects', () => {
    const error = new TypeError('Invalid type');
    const result = serializeError(error);

    expect(result['error.message']).toBe('Invalid type');
    expect(result['error.type']).toBe('TypeError');
  });

  it('serializes errors with cause', () => {
    const cause = new Error('Root cause');
    const error = new Error('Wrapper error', { cause });
    const result = serializeError(error);

    expect(result['error.message']).toBe('Wrapper error');
    expect(result['error.cause']).toEqual({
      'error.message': 'Root cause',
      'error.type': 'Error',
      'error.stack_trace': expect.any(String),
    });
  });

  it('serializes errors with code', () => {
    const error = new Error('Connection refused') as Error & { code: string };
    error.code = 'ECONNREFUSED';
    const result = serializeError(error);

    expect(result['error.message']).toBe('Connection refused');
    expect(result['error.code']).toBe('ECONNREFUSED');
  });

  it('serializes non-Error objects', () => {
    const result = serializeError({ foo: 'bar' });

    expect(result['error.message']).toBe('[object Object]');
    expect(result['error.type']).toBe('object');
  });

  it('serializes null', () => {
    const result = serializeError(null);

    expect(result['error.message']).toBe('null');
    expect(result['error.type']).toBe('object');
  });

  it('serializes undefined', () => {
    const result = serializeError(undefined);

    expect(result['error.message']).toBe('undefined');
    expect(result['error.type']).toBe('undefined');
  });
});
