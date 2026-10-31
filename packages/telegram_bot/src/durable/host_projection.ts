import { assistantRequest } from '@eddo/assistant-server/request_channel';
import type { RuntimeRequestInput } from '@eddo/assistant-server/state';
import type { AssistantRuntimeOptions } from './assistant_runtime.js';
import { projectAcceptedMessage, projectDurableExchange } from './projection.js';

/** Serializes admission and reply projections through the same per-account writer. */
export function createHostProjection(
  username: string,
): Pick<AssistantRuntimeOptions, 'project' | 'projectAccepted'> {
  let tail = Promise.resolve();
  const serialize = (effect: () => Promise<void>): Promise<void> => {
    const pending = tail.then(effect);
    tail = pending.catch(() => undefined);
    return pending;
  };
  return {
    project: (input, answer) =>
      serialize(() => projectDurableExchange({ username, input, answer })),
    projectAccepted: (input: RuntimeRequestInput) =>
      serialize(() => projectAcceptedMessage(assistantRequest(username, input))),
  };
}
