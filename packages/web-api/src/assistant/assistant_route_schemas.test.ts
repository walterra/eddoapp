import { describe, expect, it } from 'vitest';
import { historySchema, streamSchema, submissionSchema } from './assistant_route_schemas';

const submission = { requestId: '123e4567-e89b-42d3-a456-426614174000', text: 'request' };

describe('assistant route validation compatibility', () => {
  it('defaults and explicitly converts history limits', () => {
    expect(historySchema.parse({})).toEqual({ limit: 30 });
    expect(historySchema.parse({ limit: undefined })).toEqual({ limit: 30 });
    expect(historySchema.parse({ limit: '50', cursor: 'cursor' })).toEqual({
      limit: 50,
      cursor: 'cursor',
    });
  });

  it.each([
    { limit: '' },
    { limit: null },
    { limit: '1.5' },
    { limit: Infinity },
    { limit: '51' },
    { limit: '1', unknown: true },
    { cursor: '😀'.repeat(2049) },
  ])('rejects previously invalid history input: %j', (value) => {
    expect(historySchema.safeParse(value).success).toBe(false);
  });

  it('trims submissions without stripping unknown fields before strict validation', () => {
    const input = Object.freeze({ ...submission, text: ' request ' });
    expect(submissionSchema.parse(input)).toEqual(submission);
    expect(input.text).toBe(' request ');
    expect(submissionSchema.safeParse({ ...input, unknown: true }).success).toBe(false);
  });

  it.each([
    { ...submission, text: '   ' },
    { ...submission, text: '😀'.repeat(4001) },
    { ...submission, requestId: '123e4567-e89b-02d3-a456-426614174000' },
    { ...submission, requestId: '123e4567-e89b-42d3-7456-426614174000' },
  ])('rejects invalid submissions', (value) => {
    expect(submissionSchema.safeParse(value).success).toBe(false);
  });

  it('preserves accepted UTF-16 boundaries', () => {
    expect(submissionSchema.parse({ ...submission, text: '😀'.repeat(4000) }).text.length).toBe(
      8000,
    );
    expect(historySchema.parse({ cursor: '😀'.repeat(2048) }).cursor?.length).toBe(4096);
  });

  it('validates streams without coercion or unknown fields', () => {
    expect(streamSchema.parse({})).toEqual({});
    expect(streamSchema.safeParse({ cursor: 123 }).success).toBe(false);
    expect(streamSchema.safeParse({ unknown: true }).success).toBe(false);
    expect(streamSchema.safeParse({ requestIds: '😀'.repeat(1501) }).success).toBe(false);
  });
});
