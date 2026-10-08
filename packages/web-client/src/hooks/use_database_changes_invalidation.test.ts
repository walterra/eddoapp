import { type QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setReplicationActive } from './replication_activity';
import { createInvalidationScheduler } from './use_database_changes';

describe('createInvalidationScheduler', () => {
  afterEach(() => {
    setReplicationActive(false);
    vi.useRealTimers();
  });

  it('flushes rapid database changes through one invalidation cycle', () => {
    vi.useFakeTimers();
    const invalidateQueries = vi.fn();
    const onFlush = vi.fn();
    const refs = {
      timer: { current: null },
      pending: { current: new Set<string>() },
    };
    const scheduler = createInvalidationScheduler({
      queryClient: { invalidateQueries } as unknown as QueryClient,
      refs,
      onFlush,
    });

    for (let index = 0; index < 200; index += 1) {
      scheduler.schedule(`todo-${index}`);
    }
    vi.advanceTimersByTime(150);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['todos'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['activities'] });
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith(200);
  });

  it('holds invalidation until active replication pauses', () => {
    vi.useFakeTimers();
    const invalidateQueries = vi.fn();
    const onFlush = vi.fn();
    const scheduler = createInvalidationScheduler({
      queryClient: { invalidateQueries } as unknown as QueryClient,
      refs: {
        timer: { current: null },
        pending: { current: new Set<string>() },
      },
      onFlush,
    });
    setReplicationActive(true);

    scheduler.schedule('todo-1');
    scheduler.schedule('todo-2');
    vi.advanceTimersByTime(1000);

    expect(invalidateQueries).not.toHaveBeenCalled();

    setReplicationActive(false);
    scheduler.flush();

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenCalledWith(2);
  });
});
