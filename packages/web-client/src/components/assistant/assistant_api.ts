import type { AssistantHistoryPage, AssistantRequestStatus } from '@eddo/core-shared';
import { historySchema, receiptSchema } from './assistant_schemas';
import { readAssistantEvents } from './assistant_sse';
import { AssistantClientError, type AssistantBrowserClient } from './assistant_types';

export interface AssistantBrowserOptions {
  username: string;
  token: string;
  fetch?: typeof fetch;
}

function responseError(response: Response): AssistantClientError {
  const codes = {
    400: 'invalid_request',
    401: 'unauthorized',
    403: 'forbidden',
    409: 'request_conflict',
    413: 'invalid_request',
    429: 'rate_limited',
  } as const;
  const code = codes[response.status as keyof typeof codes] ?? 'unavailable';
  const seconds = Number(response.headers.get('Retry-After'));
  const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : 60;
  return new AssistantClientError(code, response.status === 429 ? retryAfter : 0);
}

async function fetchAssistant(
  options: AssistantBrowserOptions,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const response = await (options.fetch ?? fetch)(`/api/assistant${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok && response.status !== 404) {
      void response.body?.cancel();
      throw responseError(response);
    }
    return response;
  } catch (error) {
    if (error instanceof AssistantClientError || init.signal?.aborted) throw error;
    throw new AssistantClientError('network');
  }
}

async function history(
  options: AssistantBrowserOptions,
  cursor?: string,
  signal?: AbortSignal,
): Promise<AssistantHistoryPage> {
  const response = await fetchAssistant(
    options,
    `/conversation${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    { signal },
  );
  try {
    const page = historySchema.parse(await response.json());
    if (
      (page.conversation && page.conversation.username !== options.username) ||
      page.messages.some((message) => message.conversationId !== page.conversation?._id)
    )
      throw new Error('Invalid history identity');
    return page;
  } catch {
    throw new AssistantClientError('protocol');
  }
}

async function receipt(response: Response, expectedId: string): Promise<AssistantRequestStatus> {
  try {
    const result = receiptSchema.parse(await response.json());
    if (result.requestId !== expectedId) throw new Error('Invalid request identity');
    return result;
  } catch {
    throw new AssistantClientError('protocol');
  }
}

/** Uses header-only authentication; sidebar teardown never supplies a cancellation signal to admission. */
export function createAssistantBrowserClient(
  options: AssistantBrowserOptions,
): AssistantBrowserClient {
  return {
    history: (cursor, signal) => history(options, cursor, signal),
    admit: async (pending) =>
      receipt(
        await fetchAssistant(options, '/messages', {
          method: 'POST',
          body: JSON.stringify({ requestId: pending.submissionId, text: pending.text }),
          signal: AbortSignal.timeout(30_000),
        }),
        `web:${options.username}:${pending.submissionId}`,
      ),
    status: async (id, signal) => {
      const response = await fetchAssistant(options, `/requests/${encodeURIComponent(id)}`, {
        signal,
      });
      if (response.status === 404) {
        void response.body?.cancel();
        return null;
      }
      return receipt(response, id);
    },
    stream: async (request) => {
      const query = new URLSearchParams();
      if (request.requestIds.length) query.set('requestIds', request.requestIds.join(','));
      const response = await fetchAssistant(options, `/stream?${query}`, {
        signal: request.signal,
        headers: request.cursor ? { 'Last-Event-ID': request.cursor } : {},
      });
      if (!response.ok) throw responseError(response);
      request.onConnected();
      await readAssistantEvents(response, request.onEvent);
    },
  };
}
