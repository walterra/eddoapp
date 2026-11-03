import type { ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';

const SHUTDOWN_TIMEOUT_MS = 2_000;

/** Signals an isolated process group, including descendants of an exited launcher. */
function signalGroup(child: ChildProcess, signal: NodeJS.Signals | 0): boolean {
  if (!child.pid) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

/** Stops a test-owned process tree and escalates when descendants remain alive. */
export async function stopProcessTree(child: ChildProcess): Promise<void> {
  if (!signalGroup(child, 'SIGTERM')) return;
  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (signalGroup(child, 0)) {
    if (Date.now() >= deadline) {
      signalGroup(child, 'SIGKILL');
      return;
    }
    await setTimeout(50);
  }
}

/** Runs cleanup once on normal completion or terminal interruption. */
export function registerRunnerCleanup(cleanup: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | undefined;
  const runCleanup = (): Promise<void> => {
    pending ??= Promise.resolve().then(cleanup);
    return pending;
  };
  const interrupt = (signal: NodeJS.Signals): void => {
    void runCleanup().then(
      () => process.exit(signal === 'SIGINT' ? 130 : 143),
      (error: unknown) => {
        console.error('Integration cleanup failed:', error);
        process.exit(1);
      },
    );
  };
  const onInterrupt = (): void => interrupt('SIGINT');
  const onTerminate = (): void => interrupt('SIGTERM');
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  return async () => {
    try {
      await runCleanup();
    } finally {
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onTerminate);
    }
  };
}
