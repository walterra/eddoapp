import { describe, expect, it } from 'vitest';
import { receiptSchema, sharedRequestsSchema } from './assistant_receipts';

const receipt = { requestId: 'request', conversationId: 'conversation', status: 'working' };

describe('shared assistant receipt contracts', () => {
  it('projects receipts without retaining diagnostic fields', () => {
    expect(receiptSchema.parse({ ...receipt, diagnostic: 'private' })).toEqual(receipt);
  });

  it.each([
    { ...receipt, status: 'unknown' },
    { ...receipt, requestId: '' },
    { ...receipt, conversationId: '😀'.repeat(129) },
  ])('rejects malformed receipts', (value) => {
    expect(receiptSchema.safeParse(value).success).toBe(false);
  });

  it('validates and projects nested receipts on shared request pages', () => {
    expect(
      sharedRequestsSchema.parse({
        requests: [{ ...receipt, private: true }],
        hasMore: false,
        private: true,
      }),
    ).toEqual({ requests: [receipt], hasMore: false });
    expect(
      sharedRequestsSchema.safeParse({
        requests: [{ ...receipt, requestId: '😀'.repeat(129) }],
        hasMore: false,
      }).success,
    ).toBe(false);
  });

  it('rejects pages beyond the existing bound', () => {
    expect(
      sharedRequestsSchema.safeParse({ requests: Array(101).fill(receipt), hasMore: true }).success,
    ).toBe(false);
  });
});
