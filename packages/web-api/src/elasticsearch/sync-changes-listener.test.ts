import type nano from 'nano';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndexMigration } from './index-migration';
import type { BatchProcessor } from './sync-batch';
import { startChangesListener } from './sync-changes-listener';
import type { DatabaseSyncState } from './sync-types';

function setup() {
  const emitter = new EventEmitter();
  const resume = vi.fn();
  const reader = { start: vi.fn(() => emitter), resume };
  const state: DatabaseSyncState = {
    dbName: 'eddo_user_test',
    esIndexName: 'eddo_user_test_v2',
    dbType: 'user',
    userId: 'test',
    lastSeq: '1',
    isRunning: true,
    changesEmitter: null,
  };
  const flushBatch = vi.fn().mockResolvedValue(undefined);
  const queueDocument = vi.fn().mockResolvedValue(undefined);
  const updateLastSeq = vi.fn().mockResolvedValue(undefined);
  startChangesListener({
    state,
    logger: pino({ enabled: false }),
    getCouchDb: () => ({ use: () => ({ changesReader: reader }) }) as unknown as nano.ServerScope,
    batchProcessor: { flushBatch, queueDocument } as unknown as BatchProcessor,
    indexMigration: { updateLastSeq } as unknown as IndexMigration,
  });
  return { emitter, resume, state, flushBatch, queueDocument, updateLastSeq };
}

const change = { id: 'deleted', seq: '2', deleted: true, changes: [] };

afterEach(() => vi.useRealTimers());

describe('changes reader acknowledgement', () => {
  it('processes each page once and resumes after indexing and checkpointing', async () => {
    const context = setup();
    context.emitter.emit('change', change);
    context.emitter.emit('batch', [change]);
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalledOnce());
    expect(context.queueDocument).toHaveBeenCalledOnce();
    expect(context.flushBatch).toHaveBeenCalledOnce();
    expect(context.updateLastSeq).toHaveBeenCalledWith('eddo_user_test_v2', '2');
    expect(context.state.lastSeq).toBe('2');
    context.emitter.emit('batch', [{ ...change, seq: '3' }]);
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalledTimes(2));
    expect(context.state.lastSeq).toBe('3');
  });

  it('holds the checkpoint and retries a failed page before resuming', async () => {
    vi.useFakeTimers();
    const context = setup();
    context.flushBatch.mockRejectedValueOnce(new Error('unavailable'));
    context.emitter.emit('batch', [change]);
    await vi.advanceTimersByTimeAsync(0);
    expect(context.state.lastSeq).toBe('1');
    expect(context.updateLastSeq).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.state.lastSeq).toBe('2');
  });
});
