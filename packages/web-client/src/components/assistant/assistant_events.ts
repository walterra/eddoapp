import { z } from 'zod';
import type { AssistantHistoryController } from './assistant_history_controller';
import { receiptSchema } from './assistant_schemas';
import { isTerminalAssistantRequest, type AssistantStateCore } from './assistant_state';
import { AssistantClientError, type AssistantServerEvent } from './assistant_types';

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
function failure(data: unknown): never {
  const result = z.object({ error: z.string() }).parse(data);
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
      case 'request-status':
        receipt(core, history, event.data);
        return;
      case 'request-missing':
        if (z.object({ requestId: z.string() }).parse(event.data).requestId === core.pendingId())
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
