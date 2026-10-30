import { createAssistantActions } from './assistant_actions';
import { createAssistantConnection, type AssistantLiveConnection } from './assistant_connection';
import { createAssistantEventHandler } from './assistant_events';
import { createAssistantHistoryController } from './assistant_history_controller';
import { createAssistantState } from './assistant_state';
import type { AssistantSession, AssistantSessionOptions } from './assistant_types';

/** Composes presentation state and read transports; the server owns generation, tools, and delivery. */
export function createAssistantSession(options: AssistantSessionOptions): AssistantSession {
  const core = createAssistantState({
    username: options.username,
    pendingStore: options.pendingStore,
    trackingChanged: () => live.restart(),
  });
  const history = createAssistantHistoryController(core, options.client, () => live.signal());
  const live: AssistantLiveConnection = createAssistantConnection({
    client: options.client,
    refresh: history.refresh,
    requestIds: () => {
      const id = core.pendingId();
      return id ? [id] : [];
    },
    event: createAssistantEventHandler(core, history),
    state: (connection, error) =>
      core.update({
        connection,
        ...(connection === 'blocked' ? { loading: false } : {}),
        ...(error ? { error } : core.get().error !== 'storage' ? { error: null } : {}),
      }),
  });
  const connection = live;
  const actions = createAssistantActions({ options, core, live: connection, history });
  return {
    subscribe: core.subscribe,
    getSnapshot: core.get,
    ...actions,
    start: () => {
      core.restore();
      connection.start();
    },
    stop: () => {
      connection.stop();
      history.stop();
    },
    refresh: async () => {
      core.restore();
      connection.stop();
      connection.start();
    },
    loadOlder: history.loadOlder,
    dismiss: core.dismiss,
  };
}
