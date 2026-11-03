import { describe, expect, it } from 'vitest';
import { createAuditEntrySchema, listBySourceQuerySchema, listQuerySchema } from './audit_schemas';

describe('audit schema compatibility', () => {
  it('preserves list defaults, projection, and numeric coercion', () => {
    expect(listQuerySchema.parse({ ignored: true })).toEqual({ limit: 50 });
    expect(listQuerySchema.parse({ limit: '25', ids: 'id' })).toEqual({ limit: 25, ids: 'id' });
    expect(listBySourceQuerySchema.parse({})).toEqual({ limitPerSource: 20 });
  });

  it('preserves fractional list limits rather than adding a new integer restriction', () => {
    expect(listQuerySchema.parse({ limit: '1.5' }).limit).toBe(1.5);
  });

  it.each(['', 'invalid', '0', '101', Infinity])('rejects invalid list limits: %j', (limit) => {
    expect(listQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('retains arbitrary audit snapshot fields while projecting the envelope', () => {
    const data = {
      action: 'update',
      entityId: 'todo',
      before: { arbitrary: { nested: true } },
      metadata: { custom: 'value' },
    };
    expect(createAuditEntrySchema.parse({ ...data, ignored: true })).toEqual(data);
    expect(createAuditEntrySchema.safeParse({ ...data, action: 'unknown' }).success).toBe(false);
  });
});
