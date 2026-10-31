import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { defineDoc, type Harness } from '@earendil-works/pi-durable';
import type { AssistantPendingRequests, AssistantRequestStatus } from '@eddo/core-shared';
import { getRequestStatus } from './request_status.js';
import { RequestMap } from './state.js';

type PendingRequestIndex = {
  initialized: boolean;
  ids: Record<string, true>;
};

export const PendingRequests = defineDoc({
  kind: 'eddo.pending-requests',
  version: 1,
  scope: 'session',
  initial: (): PendingRequestIndex => ({
    initialized: false,
    ids: {},
  }),
});

/** Seeds the index from existing journals before recovered tasks resume. */
export async function initializePendingRequests(harness: Harness): Promise<void> {
  if ((await harness.snapshot(PendingRequests, context))?.initialized) return;
  const ids = Object.keys((await harness.snapshot(RequestMap, context))?.tasks ?? {});
  for (let offset = 0; offset < ids.length; offset += 100) {
    const requests = await Promise.all(
      ids.slice(offset, offset + 100).map((id) => getRequestStatus(harness, id)),
    );
    await harness.commit(async (tx) => {
      const index = await tx.doc(PendingRequests);
      for (const request of requests)
        if (request && !terminal(request.status)) index.ids[request.requestId] = true;
    }, context);
  }
  await harness.commit(async (tx) => {
    (await tx.doc(PendingRequests)).initialized = true;
  }, context);
}
function terminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'aborted';
}

/** Returns bounded account-owned lifecycle snapshots and prunes settled index entries. */
export async function getPendingRequests(harness: Harness): Promise<AssistantPendingRequests> {
  const ids = Object.keys((await harness.snapshot(PendingRequests, context))?.ids ?? {});
  const batch = ids.slice(0, 100);
  const statuses = await Promise.all(batch.map((id) => getRequestStatus(harness, id)));
  const requests = statuses.filter(
    (status): status is AssistantRequestStatus => status !== null && !terminal(status.status),
  );
  const settled = batch.filter(
    (_id, index) => !statuses[index] || terminal(statuses[index]!.status),
  );
  if (settled.length)
    await harness.commit(async (tx) => {
      const index = await tx.doc(PendingRequests);
      for (const id of settled) delete index.ids[id];
    }, context);
  return { requests, hasMore: ids.length > batch.length };
}
