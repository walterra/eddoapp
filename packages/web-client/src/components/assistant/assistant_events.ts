import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import { obj, str } from '@eddo/core-shared/validation/schema_parser';
import type { AssistantHistoryController } from './assistant_history_controller';
import { receiptSchema, sharedRequestsSchema } from './assistant_schemas';
import { isTerminalAssistantRequest, type AssistantStateCore } from './assistant_state';
import { AssistantClientError, type AssistantServerEvent } from './assistant_types';

const errorSchema = createProjectedParser(obj({ error: str() }));
const missingSchema = createProjectedParser(obj({ requestId: str() }));

function receipt(
  core: AssistantStateCore,
  history: AssistantHistoryController,
  data: unknown,
): void {
  const result = receiptSchema.parse(data);
  core.accept(result);
  if (result.requestId === core.pendingId() && isTerminalAssistantRequest(result.status))
    history.invalidate();
}
function sharedRequests(
  core: AssistantStateCore,
  history: AssistantHistoryController,
  data: unknown,
): void {
  const page = sharedRequestsSchema.parse(data);
  const previous = core.get().sharedRequests ?? [];
  core.update({ sharedRequests: page.requests, sharedHasMore: page.hasMore });
  for (const request of page.requests) core.accept(request);
  if (
    previous.some((request) => !page.requests.some((next) => next.requestId === request.requestId))
  )
    history.invalidate();
}

function failure(data: unknown): never {
  const result = errorSchema.parse(data);
  throw new AssistantClientError(
    result.error === 'unauthorized' || result.error === 'forbidden' ? result.error : 'unavailable',
  );
}

/** Applies validated server events only to the currently tracked account request. */
export function createAssistantEventHandler(
  core: AssistantStateCore,
  history: AssistantHistoryController,
): (event: AssistantServerEvent) => void {
  return (event) => {
    switch (event.event) {
      case 'history-change':
      case 'reset':
        history.invalidate();
        return;
      case 'pending-requests':
        sharedRequests(core, history, event.data);
        return;
      case 'request-status':
        receipt(core, history, event.data);
        return;
      case 'request-missing':
        if (missingSchema.parse(event.data).requestId === core.pendingId())
          core.update({ error: 'unavailable' });
        return;
      case 'unavailable':
        core.update({ error: 'unavailable' });
        return;
      case 'error':
        return failure(event.data);
      default:
        return;
    }
  };
}
