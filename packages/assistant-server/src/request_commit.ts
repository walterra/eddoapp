import type { Context } from '@earendil-works/chord';
import { PendingRequests } from './pending_requests.js';
import type { RequestRuntime } from './request_generation.js';

type RequestChange = Parameters<RequestRuntime['commit']>[0];

/** Removes settled work from discovery in the same transaction as its terminal checkpoint. */
export async function commitRequestState(
  runtime: RequestRuntime,
  change: RequestChange,
  context: Context,
): Promise<void> {
  await runtime.commit(async (tx, current) => {
    const next = await change(tx, current);
    if (next?.status === 'terminal')
      delete (await tx.doc(PendingRequests)).ids[current.input.requestId];
    return next;
  }, context);
}
