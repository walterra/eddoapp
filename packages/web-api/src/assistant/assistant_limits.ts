import { AssistantApiError } from './assistant_errors';

interface WindowCount {
  ends: number;
  reads: number;
  writes: number;
}
export interface AssistantLimits {
  consume: (username: string, write: boolean) => void;
  acquireStream: (username: string) => () => void;
}

/** Removes expired account keys before reserving another bounded rate-limit slot. */
function reserveWindow(
  windows: Map<string, WindowCount>,
  username: string,
  now: number,
): WindowCount {
  if (!windows.has(username)) {
    for (const [key, value] of windows) if (value.ends <= now) windows.delete(key);
    if (windows.size >= 10_000) throw new AssistantApiError(429, 'rate_limited');
  }
  const existing = windows.get(username);
  if (existing && existing.ends > now) return existing;
  const created = { ends: now + 60_000, reads: 0, writes: 0 };
  windows.set(username, created);
  return created;
}

/** Bounds per-account request rates and live streams without retaining unbounded user keys. */
export function createAssistantLimits(clock: () => number = Date.now): AssistantLimits {
  const windows = new Map<string, WindowCount>();
  const streams = new Map<string, number>();
  let live = 0;
  const consume = (username: string, write: boolean): void => {
    const window = reserveWindow(windows, username, clock());
    const key = write ? 'writes' : 'reads';
    if (window[key] >= (write ? 10 : 120)) throw new AssistantApiError(429, 'rate_limited');
    window[key] += 1;
  };
  const acquireStream = (username: string): (() => void) => {
    const count = streams.get(username) ?? 0;
    if (count >= 2 || live >= 100) throw new AssistantApiError(429, 'rate_limited');
    streams.set(username, count + 1);
    live += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      live -= 1;
      const remaining = (streams.get(username) ?? 1) - 1;
      if (remaining) streams.set(username, remaining);
      else streams.delete(username);
    };
  };
  return { consume, acquireStream };
}
