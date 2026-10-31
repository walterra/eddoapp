import {
  AssistantClientError,
  type AssistantBrowserClient,
  type AssistantConnection,
  type AssistantErrorCode,
  type AssistantServerEvent,
} from './assistant_types';

export interface AssistantConnectionOptions {
  client: AssistantBrowserClient;
  refresh: (signal: AbortSignal) => Promise<string>;
  requestIds: () => string[];
  event: (event: AssistantServerEvent) => void;
  state: (connection: AssistantConnection, error?: AssistantErrorCode) => void;
}
export interface AssistantLiveConnection {
  start: () => void;
  stop: () => void;
  restart: () => void;
  signal: () => AbortSignal | undefined;
}
interface ConnectionRun {
  root: AbortController;
  stream?: AbortController;
  cursor?: string;
  backoff: number;
}

/** Cancels reconnect waits without leaving timers or abort listeners behind. */
async function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}
async function connect(options: AssistantConnectionOptions, run: ConnectionRun): Promise<void> {
  const signal = run.root.signal;
  run.stream = undefined;
  const snapshotCursor = await options.refresh(signal);
  run.cursor ??= snapshotCursor;
  signal.throwIfAborted();
  run.stream = new AbortController();
  await options.client.stream({
    cursor: run.cursor,
    requestIds: options.requestIds(),
    signal: AbortSignal.any([signal, run.stream.signal]),
    onConnected: () => {
      run.backoff = 1000;
      options.state('connected');
    },
    onEvent: (event) => {
      if (event.id) {
        if (event.id.length > 4096) throw new AssistantClientError('protocol');
        run.cursor = event.id;
      }
      options.event(event);
    },
  });
  if (!signal.aborted) {
    options.state('reconnecting');
    await pause(1000, signal);
  }
}
async function failure(
  options: AssistantConnectionOptions,
  run: ConnectionRun,
  error: unknown,
): Promise<void> {
  if (run.root.signal.aborted || run.stream?.signal.aborted) return;
  const result =
    error instanceof AssistantClientError ? error : new AssistantClientError('network');
  if (result.code === 'unauthorized' || result.code === 'forbidden') {
    options.state('blocked', result.code);
    run.root.abort();
    return;
  }
  if (result.code === 'invalid_request') run.cursor = undefined;
  options.state('reconnecting', result.code);
  await pause(Math.max(run.backoff, result.retryAfter * 1000), run.root.signal).catch(
    () => undefined,
  );
  run.backoff = Math.min(run.backoff * 2, 15_000);
}
async function loop(options: AssistantConnectionOptions, run: ConnectionRun): Promise<void> {
  while (!run.root.signal.aborted) {
    try {
      await connect(options, run);
    } catch (error) {
      await failure(options, run, error);
    }
  }
}

/** Owns read-only connections; retries never resubmit messages or cancel durable execution. */
export function createAssistantConnection(
  options: AssistantConnectionOptions,
): AssistantLiveConnection {
  let active: ConnectionRun | undefined;
  return {
    start: () => {
      if (active && !active.root.signal.aborted) return;
      active = { root: new AbortController(), backoff: 1000 };
      options.state('connecting');
      void loop(options, active).catch(() => undefined);
    },
    stop: () => {
      active?.root.abort();
      active?.stream?.abort();
    },
    restart: () => active?.stream?.abort(),
    signal: () => active?.root.signal,
  };
}
