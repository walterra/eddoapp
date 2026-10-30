import type { AssistantPendingRequests } from '@eddo/core-shared';
import { z } from 'zod';
import { AssistantApiError } from './assistant_errors';
import type { AssistantHostOptions } from './assistant_host_client';
import { receiptSchema } from './assistant_receipts';
import { boundedJson } from './bounded_json';

const pendingSchema = z.object({ requests: z.array(receiptSchema).max(100), hasMore: z.boolean() });

async function pendingResponse(
  response: Response,
  username: string,
): Promise<AssistantPendingRequests> {
  if (!response.ok) {
    void response.body?.cancel();
    if (response.status === 403) throw new AssistantApiError(403, 'forbidden');
    throw new AssistantApiError(503, 'unavailable');
  }
  const result = pendingSchema.parse(await boundedJson(response, 65_536));
  if (
    result.requests.some(
      (request) =>
        request.requestId.startsWith('web:') && !request.requestId.startsWith(`web:${username}:`),
    )
  )
    throw new AssistantApiError(503, 'unavailable');
  return result;
}

/** Reads bounded account-owned work from the sole owner without admitting or resuming work itself. */
export async function readHostPendingRequests(
  options: AssistantHostOptions,
  username: string,
  signal?: AbortSignal,
): Promise<AssistantPendingRequests> {
  if (!options.token) throw new AssistantApiError(503, 'unavailable');
  try {
    const timeout = AbortSignal.timeout(30_000);
    const response = await (options.fetch ?? fetch)(
      `http://127.0.0.1:${options.port}/internal/assistant/pending`,
      {
        method: 'POST',
        redirect: 'error',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      },
    );
    return await pendingResponse(response, username);
  } catch (error) {
    if (error instanceof AssistantApiError) throw error;
    throw new AssistantApiError(503, 'unavailable');
  }
}
