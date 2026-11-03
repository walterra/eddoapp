import type { Client } from '@elastic/elasticsearch';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { createBatchProcessor } from './sync-batch';

describe('bulk acknowledgement', () => {
  it('retains rejected operations and retries them before newer operations', async () => {
    const bulk = vi
      .fn()
      .mockResolvedValueOnce({ errors: true, took: 1, items: [{ delete: { error: {} } }] })
      .mockResolvedValue({ errors: false, took: 1, items: [] });
    const processor = createBatchProcessor({
      esClient: { bulk } as unknown as Client,
      logger: pino({ enabled: false }),
      batchSize: 1,
      batchTimeoutMs: 1000,
    });
    await expect(
      processor.queueDocument({
        action: 'delete',
        id: 'old',
        indexName: 'todos',
      }),
    ).rejects.toThrow('rejected 1');
    expect(processor.getPendingCount()).toBe(1);
    await processor.queueDocument({ action: 'delete', id: 'new', indexName: 'todos' });
    expect(bulk.mock.calls[1][0].operations).toEqual([
      { delete: { _id: 'old', _index: 'todos' } },
      { delete: { _id: 'new', _index: 'todos' } },
    ]);
    expect(processor.getPendingCount()).toBe(0);
  });
});
