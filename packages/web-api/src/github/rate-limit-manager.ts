/**
 * GitHub API rate limit manager
 * Handles request throttling, automatic retry with exponential backoff, and rate limit monitoring
 */

import {
  extractRateLimitHeaders,
  formatResetTime,
  isRateLimitError,
  type RateLimitInfo,
} from './rate-limit.js';

export interface RateLimitManagerConfig {
  maxRetries: number; // Maximum retry attempts (default: 3)
  baseDelayMs: number; // Base delay for exponential backoff (default: 1000ms)
  minRequestIntervalMs: number; // Minimum time between requests (default: 100ms)
  warningThresholdPercent: number; // Warn when rate limit falls below this % (default: 20)
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
    debug: (msg: string, meta?: unknown) => void;
  };
}

export interface RateLimitManager {
  executeWithRateLimit: <T>(fn: () => Promise<T>) => Promise<T>;
  getLastRateLimitInfo: () => RateLimitInfo | null;
}

/** Sleeps for specified milliseconds */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Calculates exponential backoff: baseDelay * 2^(retryCount - 1) */
const calculateBackoffDelay = (baseDelayMs: number, retryCount: number): number =>
  baseDelayMs * Math.pow(2, retryCount - 1);

/** Creates a request queue manager */
function createRequestQueueManager() {
  let isRequestInProgress = false;
  const requestQueue: Array<() => void> = [];

  const processQueue = (): void => {
    if (isRequestInProgress || requestQueue.length === 0) return;
    const nextRequest = requestQueue.shift();
    if (nextRequest) nextRequest();
  };

  const enqueue = async (): Promise<void> =>
    new Promise<void>((resolve) => {
      requestQueue.push(resolve);
      processQueue();
    });

  const setInProgress = (value: boolean): void => {
    isRequestInProgress = value;
    if (!value) processQueue();
  };

  return { enqueue, setInProgress };
}

/** Creates a throttle manager */
function createThrottleManager(minIntervalMs: number, logger: RateLimitManagerConfig['logger']) {
  let lastRequestTime = 0;

  return async (): Promise<void> => {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < minIntervalMs) {
      const waitMs = minIntervalMs - timeSinceLastRequest;
      logger.debug('Throttling request', { waitMs });
      await sleep(waitMs);
    }
    lastRequestTime = Date.now();
  };
}

/**
 * Creates a rate limit manager for GitHub API requests
 * Provides automatic retry, throttling, and monitoring
 */
export function createRateLimitManager(config: RateLimitManagerConfig): RateLimitManager {
  const lastRateLimitInfo: RateLimitInfo | null = null;
  const queue = createRequestQueueManager();
  const throttle = createThrottleManager(config.minRequestIntervalMs, config.logger);

  const executeWithRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
    let retryCount = 0;

    while (retryCount <= config.maxRetries) {
      try {
        await queue.enqueue();
        queue.setInProgress(true);
        await throttle();

        const result = await fn();
        queue.setInProgress(false);
        return result;
      } catch (error) {
        queue.setInProgress(false);

        if (!isRateLimitError(error)) throw error;

        retryCount++;
        config.logger.warn('GitHub API rate limit hit', {
          retryCount,
          maxRetries: config.maxRetries,
          error: error.message,
        });

        if (retryCount > config.maxRetries) {
          config.logger.error('Max retries exceeded for rate limit', {
            retryCount,
            maxRetries: config.maxRetries,
          });
          throw error;
        }

        const backoffDelay = calculateBackoffDelay(config.baseDelayMs, retryCount);
        config.logger.info('Retrying with exponential backoff', {
          retryCount,
          backoffDelayMs: backoffDelay,
        });
        await sleep(backoffDelay);
      }
    }

    throw new Error('Unexpected error in rate limit manager');
  };

  return {
    executeWithRateLimit,
    getLastRateLimitInfo: () => lastRateLimitInfo,
  };
}

/**
 * Helper to wrap API response with rate limit header extraction
 * Use this to wrap Octokit responses before processing
 */
export function wrapResponseWithRateLimitHeaders<T extends { headers: Record<string, unknown> }>(
  response: T,
  logger: RateLimitManagerConfig['logger'],
): T {
  const headers = response.headers as Record<string, string | number | undefined>;
  const rateLimitInfo = extractRateLimitHeaders(headers);

  if (rateLimitInfo) {
    logger.debug('Extracted rate limit info from response', {
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      resetTime: formatResetTime(rateLimitInfo.resetDate),
    });
  }

  return response;
}
