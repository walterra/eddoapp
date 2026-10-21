import type { DurableRequestInput } from './state.js';

export const MAX_DELIVERY_FAILURES = 5;
const RETRY_DELAY_MS = 30_000;
const INTERACTIVE_DELIVERY_GRACE_MS = 3_600_000;

export interface DeliveryRetry {
  retryAt?: number;
  failure?: string;
}

/** Bounds report delivery to its local day and interactive delivery to one additional hour. */
export function deliveryDeadline(input: DurableRequestInput): number {
  return input.deadline + (input.report ? 0 : INTERACTIVE_DELIVERY_GRACE_MS);
}

/** Reads Telegram response fields without retaining response bodies or recipient details. */
function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('error_code' in error)) return undefined;
  return typeof error.error_code === 'number' ? error.error_code : undefined;
}

function retryDelay(error: unknown): number {
  if (!error || typeof error !== 'object' || !('parameters' in error)) return RETRY_DELAY_MS;
  const parameters = error.parameters;
  if (!parameters || typeof parameters !== 'object' || !('retry_after' in parameters))
    return RETRY_DELAY_MS;
  const seconds = parameters.retry_after;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? Math.max(RETRY_DELAY_MS, seconds * 1000)
    : RETRY_DELAY_MS;
}

/** Stops permanent failures and bounds transient retries by count and delivery expiry. */
export function deliveryRetry(
  error: unknown,
  failures: number,
  deadline: number,
  now = Date.now(),
): DeliveryRetry {
  const code = errorCode(error);
  if (code !== undefined && code >= 400 && code < 500 && code !== 429)
    return { failure: 'Telegram permanently rejected delivery.' };
  if (failures >= MAX_DELIVERY_FAILURES)
    return { failure: 'Telegram delivery retry limit reached.' };
  const retryAt = now + retryDelay(error);
  if (retryAt >= deadline) return { failure: 'Telegram delivery deadline expired.' };
  return { retryAt };
}
