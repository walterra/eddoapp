import { describe, expect, it } from 'vitest';

import {
  internalAdmissionSchema,
  internalPendingSchema,
  internalStatusSchema,
} from './internal_protocol';

const admission = {
  username: 'test-user',
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  text: 'request',
};

describe('internal protocol schema compatibility', () => {
  it('trims admission text without changing its input', () => {
    const input = Object.freeze({ ...admission, text: '  request\n' });
    expect(internalAdmissionSchema.parse(input)).toEqual(admission);
    expect(input.text).toBe('  request\n');
  });

  it.each([
    { ...admission, text: '   ' },
    { ...admission, extra: true },
    { ...admission, username: '../admin' },
    { ...admission, text: 'x'.repeat(8_001) },
    { ...admission, text: '😀'.repeat(4_001) },
    { ...admission, requestId: '123e4567-e89b-02d3-a456-426614174000' },
    { ...admission, requestId: '123e4567-e89b-42d3-7456-426614174000' },
    { ...admission, text: 42 },
    null,
  ])('rejects previously invalid admissions: %j', (input) => {
    expect(internalAdmissionSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '123E4567-E89B-42D3-A456-426614174000',
  ])('accepts supported UUID forms: %s', (requestId) => {
    expect(internalAdmissionSchema.parse({ ...admission, requestId }).requestId).toBe(requestId);
  });

  it('accepts the existing UTF-16 text boundary', () => {
    const text = '😀'.repeat(4_000);
    expect(internalAdmissionSchema.parse({ ...admission, text }).text).toBe(text);
  });

  it('preserves arbitrary bounded status request identifiers', () => {
    expect(internalStatusSchema.parse({ username: 'test', requestId: 'not-a-uuid' })).toEqual({
      username: 'test',
      requestId: 'not-a-uuid',
    });
    expect(
      internalStatusSchema.safeParse({ username: 'test', requestId: '😀'.repeat(129) }).success,
    ).toBe(false);
  });

  it('rejects unknown properties in pending queries', () => {
    expect(internalPendingSchema.safeParse({ username: 'test', extra: true }).success).toBe(false);
    expect(internalPendingSchema.parse({ username: 'test' })).toEqual({ username: 'test' });
  });
});
