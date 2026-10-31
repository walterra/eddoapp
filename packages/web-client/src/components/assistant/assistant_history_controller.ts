import type { AssistantStateCore } from './assistant_state';
import type { AssistantBrowserClient } from './assistant_types';

interface HistoryContext {
  core: AssistantStateCore;
  client: AssistantBrowserClient;
  signal: () => AbortSignal | undefined;
  flight?: Promise<string>;
  flightSignal?: AbortSignal;
  dirty: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
export interface AssistantHistoryController {
  refresh: (signal?: AbortSignal) => Promise<string>;
  invalidate: () => void;
  loadOlder: () => Promise<void>;
  stop: () => void;
}
function invalidate(context: HistoryContext): void {
  if (context.timer || context.signal()?.aborted) return;
  context.timer = setTimeout(() => {
    context.timer = undefined;
    const signal = context.signal();
    if (signal && !signal.aborted)
      void refresh(context, signal).catch((error) => {
        if (!signal.aborted) context.core.report(error);
      });
  }, 250);
}
async function refresh(context: HistoryContext, signal?: AbortSignal): Promise<string> {
  if (context.flight && context.flightSignal === signal) {
    context.dirty = true;
    return context.flight;
  }
  context.dirty = false;
  context.flightSignal = signal;
  const current = context.client
    .history(undefined, signal)
    .then((page) => {
      signal?.throwIfAborted();
      context.core.history(page, false);
      return page.changeCursor;
    })
    .finally(() => {
      if (context.flight !== current) return;
      context.flight = undefined;
      if (context.dirty && signal && !signal.aborted) {
        context.dirty = false;
        invalidate(context);
      }
    });
  context.flight = current;
  return current;
}
async function loadOlder(context: HistoryContext): Promise<void> {
  const state = context.core.get();
  if (!state.nextCursor || state.loadingOlder) return;
  context.core.update({ loadingOlder: true });
  const signal = context.signal();
  try {
    const page = await context.client.history(state.nextCursor, signal);
    signal?.throwIfAborted();
    if (context.core.get().conversation?._id === state.conversation?._id)
      context.core.history(page, true);
  } catch (error) {
    if (!signal?.aborted) context.core.report(error);
  } finally {
    context.core.update({ loadingOlder: false });
  }
}

/** Coalesces history invalidations without advancing a live cursor from older pagination responses. */
export function createAssistantHistoryController(
  core: AssistantStateCore,
  client: AssistantBrowserClient,
  signal: () => AbortSignal | undefined,
): AssistantHistoryController {
  const context: HistoryContext = { core, client, signal, dirty: false };
  return {
    refresh: (signal) => refresh(context, signal),
    invalidate: () => invalidate(context),
    loadOlder: () => loadOlder(context),
    stop: () => {
      clearTimeout(context.timer);
      context.timer = undefined;
    },
  };
}
