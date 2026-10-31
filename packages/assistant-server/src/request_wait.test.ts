import { awaitWithContext } from '@earendil-works/chord/context';
import type { Harness, TaskId } from '@earendil-works/pi-durable';
import { describe, expect, it, vi } from 'vitest';
import { isDeliveredRequestFailure } from './request_failure.js';
import { isPendingDurableRequest, waitForRequestResult } from './request_wait.js';

const taskId = 1 as TaskId<string>;

function harnessWithOutcome(outcome: unknown): Pick<Harness, 'waitForTask'> {
  return { waitForTask: vi.fn().mockResolvedValue({ state: { outcome } }) };
}

describe('durable request waiting', () => {
  it('marks a timed-out wait as pending without cancelling underlying work', async () => {
    let finish = (): void => {};
    const work = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const harness: Pick<Harness, 'waitForTask'> = {
      waitForTask: vi.fn().mockImplementation((_id, context) => awaitWithContext(work, context)),
    };
    const error = await waitForRequestResult(harness, taskId, {
      requestId: 'telegram:bot:1',
      timeoutMs: 1,
    }).catch((reason: unknown) => reason);
    expect(isPendingDurableRequest(error)).toBe(true);
    expect(error).toMatchObject({ requestId: 'telegram:bot:1', durablePending: true });
    finish();
    await expect(work).resolves.toBeUndefined();
  });

  it('marks lost waiters as unconfirmed rather than reporting execution failure', async () => {
    const harness = { waitForTask: vi.fn().mockRejectedValue(new Error('Harness closed')) };
    const error = await waitForRequestResult(harness, taskId, { requestId: 'request' }).catch(
      (reason: unknown) => reason,
    );
    expect(isPendingDurableRequest(error)).toBe(true);
  });

  it('returns completed results without marking them pending', async () => {
    await expect(
      waitForRequestResult(harnessWithOutcome({ status: 'completed', result: 'Answer' }), taskId, {
        requestId: 'request',
      }),
    ).resolves.toBe('Answer');
  });

  it('preserves already-delivered failure notices', async () => {
    const error = await waitForRequestResult(
      harnessWithOutcome({
        status: 'failed',
        result: 'Failure notice',
        error: { message: 'Generation failed' },
      }),
      taskId,
      { requestId: 'request' },
    ).catch((reason: unknown) => reason);
    expect(isDeliveredRequestFailure(error)).toBe(true);
    expect(isPendingDurableRequest(error)).toBe(false);
  });

  it('does not mark known terminal failures pending', async () => {
    await expect(
      waitForRequestResult(
        harnessWithOutcome({
          status: 'failed',
          error: { message: 'Delivery rejected' },
        }),
        taskId,
        { requestId: 'request' },
      ),
    ).rejects.toThrow('Durable request failed');
    expect(isPendingDurableRequest(new Error('Admission failed'))).toBe(false);
  });
});
