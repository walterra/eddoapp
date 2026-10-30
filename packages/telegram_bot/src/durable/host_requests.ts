import {
  InternalAssistantError,
  type InternalAdmission,
  type InternalAssistantOperations,
  type InternalStatusQuery,
} from '@eddo/assistant-server/internal_protocol';
import { AssistantRequestConflictError } from '@eddo/assistant-server/request_identity';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import type { AssistantRequest, AssistantRequestStatus } from '@eddo/core-shared';
import { AssistantAuthorizationError, resolveAssistantAccount } from './account_authorization.js';

export interface WebHostDependencies {
  runtime: (username: string) => Promise<DurableRuntime>;
  conversationId: (username: string) => Promise<string>;
}

function serviceError(error: unknown): never {
  if (error instanceof AssistantAuthorizationError)
    throw new InternalAssistantError(403, 'forbidden');
  if (error instanceof AssistantRequestConflictError)
    throw new InternalAssistantError(409, 'request_conflict');
  throw error;
}

/** Resolves conversation routing and timing inside the sole owner, not from browser-supplied fields. */
async function admit(
  dependencies: WebHostDependencies,
  input: InternalAdmission,
): Promise<AssistantRequestStatus> {
  await resolveAssistantAccount({ username: input.username });
  const runtime = await dependencies.runtime(input.username);
  const request: AssistantRequest = {
    account: { username: input.username },
    requestId: `web:${input.username}:${input.requestId}`,
    conversationId: await dependencies.conversationId(input.username),
    text: input.text,
    source: { channel: 'web' },
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
  await runtime.enqueue(request);
  const status = await runtime.getRequestStatus(request.requestId);
  if (!status) throw new InternalAssistantError(503, 'unavailable');
  return status;
}

async function status(
  dependencies: WebHostDependencies,
  input: InternalStatusQuery,
): Promise<AssistantRequestStatus | null> {
  await resolveAssistantAccount({ username: input.username });
  if (!input.requestId.startsWith(`web:${input.username}:`))
    throw new InternalAssistantError(403, 'forbidden');
  return (await dependencies.runtime(input.username)).getRequestStatus(input.requestId);
}

/** Shares the existing runtime cache for web admission and status without another execution owner. */
export function createWebHostOperations(
  dependencies: WebHostDependencies,
): InternalAssistantOperations {
  return {
    admit: async (input) => {
      try {
        return await admit(dependencies, input);
      } catch (error) {
        return serviceError(error);
      }
    },
    status: async (input) => {
      try {
        return await status(dependencies, input);
      } catch (error) {
        return serviceError(error);
      }
    },
  };
}
