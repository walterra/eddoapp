import type { AssistantRequestStatus } from '@eddo/core-shared';
import { z } from 'zod';
import { AssistantApiError } from './assistant_errors';
import { readHostPendingRequests } from './assistant_pending_client';
import { receiptSchema } from './assistant_receipts';
import type { AssistantHostClient } from './assistant_types';
import { boundedJson } from './bounded_json';

export interface AssistantHostOptions {
  port: number;
  token?: string;
  fetch?: typeof fetch;
}

function hostFailure(status: number): never {
  if (status === 403) throw new AssistantApiError(403, 'forbidden');
  if (status === 409) throw new AssistantApiError(409, 'request_conflict');
  if (status === 413) throw new AssistantApiError(413, 'body_too_large');
  throw new AssistantApiError(503, 'unavailable');
}

interface HostCall {
  path: 'admit' | 'status';
  body: unknown;
  expectedId: string;
  signal?: AbortSignal;
}

/** Validates bounded receipts before exposing them to the browser. */
async function readReceipt(
  response: Response,
  call: HostCall,
): Promise<AssistantRequestStatus | null> {
  if (response.status === 404 && call.path === 'status') {
    void response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    void response.body?.cancel();
    return hostFailure(response.status);
  }
  const result = receiptSchema.parse(await boundedJson(response, 4096));
  if (result.requestId !== call.expectedId) throw new AssistantApiError(503, 'unavailable');
  return result;
}

/** Bounds transport failures without retrying ambiguous admission. */
async function callHost(
  options: AssistantHostOptions,
  call: HostCall,
): Promise<AssistantRequestStatus | null> {
  if (!options.token) throw new AssistantApiError(503, 'unavailable');
  try {
    const timeout = AbortSignal.timeout(30_000);
    const response = await (options.fetch ?? fetch)(
      `http://127.0.0.1:${options.port}/internal/assistant/${call.path}`,
      {
        method: 'POST',
        redirect: 'error',
        signal: call.signal ? AbortSignal.any([call.signal, timeout]) : timeout,
        headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(call.body),
      },
    );
    return await readReceipt(response, call);
  } catch (error) {
    if (error instanceof AssistantApiError) throw error;
    throw new AssistantApiError(503, 'unavailable');
  }
}

/** Uses loopback service credentials; only read-only status calls accept browser cancellation. */
export function createAssistantHostClient(options: AssistantHostOptions): AssistantHostClient {
  z.number().int().min(1).max(65535).parse(options.port);
  z.string().min(32).optional().parse(options.token);
  return {
    pending: (username, signal) => readHostPendingRequests(options, username, signal),
    admit: async (username, input) => {
      const result = await callHost(options, {
        path: 'admit',
        body: { username, requestId: input.requestId, text: input.text },
        expectedId: `web:${username}:${input.requestId}`,
      });
      if (!result) throw new AssistantApiError(503, 'unavailable');
      return result;
    },
    status: (username, requestId, signal) =>
      callHost(options, {
        path: 'status',
        body: { username, requestId },
        expectedId: requestId,
        signal,
      }),
  };
}
