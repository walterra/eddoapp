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

/**
 * Creates a rate limit manager for GitHub API requests
 * Provides automatic retry, throttling, and monitoring
 */
export function createRateLimitManager(config: RateLimitManagerConfig): RateLimitManager {
  let lastRequestTime = 0;
  // Rate limit info is tracked in client.ts, not here
  // This is kept for the getLastRateLimitInfo() API but always returns null
  const lastRateLimitInfo: RateLimitInfo | null = null;
  let isRequestInProgress = false;
  const requestQueue: Array<() => void> = [];

  /**
   * Sleeps for specified milliseconds
   */
  const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  /**
   * Calculates exponential backoff delay
   * Formula: baseDelay * 2^(retryCount - 1)
   * Examples: 1s, 2s, 4s, 8s...
   */
  const calculateBackoffDelay = (retryCount: number): number => {
    return config.baseDelayMs * Math.pow(2, retryCount - 1);
  };

  /**
   * Enforces minimum interval between requests (throttling)
   */
  const throttleRequest = async (): Promise<void> => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < config.minRequestIntervalMs) {
      const waitMs = config.minRequestIntervalMs - timeSinceLastRequest;
      config.logger.debug('Throttling request', { waitMs });
      await sleep(waitMs);
    }

    lastRequestTime = Date.now();
  };

  /**
   * Processes next request in queue
   */
  const processQueue = (): void => {
    if (isRequestInProgress || requestQueue.length === 0) {
      return;
    }

    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      nextRequest();
    }
  };

  /**
   * Queues a request and waits for it to be processed
   */
  const enqueueRequest = async (): Promise<void> => {
    return new Promise<void>((resolve) => {
      requestQueue.push(resolve);
      processQueue();
    });
  };

  /**
   * Executes a function with rate limit handling
   * Includes throttling, automatic retry, and rate limit monitoring
   */
  const executeWithRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
    let retryCount = 0;

    while (retryCount <= config.maxRetries) {
      try {
        // Queue and throttle request
        await enqueueRequest();
        isRequestInProgress = true;
        await throttleRequest();

        // Execute function
        const result = await fn();

        // Success - process next queued request
        isRequestInProgress = false;
        processQueue();

        return result;
      } catch (error) {
        isRequestInProgress = false;
        processQueue();

        // Check if it's a rate limit error
        if (isRateLimitError(error)) {
          retryCount++;

          config.logger.warn('GitHub API rate limit hit', {
            retryCount,
            maxRetries: config.maxRetries,
            error: error.message,
          });

          // Max retries exceeded
          if (retryCount > config.maxRetries) {
            config.logger.error('Max retries exceeded for rate limit', {
              retryCount,
              maxRetries: config.maxRetries,
            });

            // Error is already enhanced with rate limit info from client.ts if available
            throw error;
          }

          // Use exponential backoff for retry
          const backoffDelay = calculateBackoffDelay(retryCount);
          config.logger.info('Retrying with exponential backoff', {
            retryCount,
            backoffDelayMs: backoffDelay,
          });
          await sleep(backoffDelay);

          // Continue to next retry iteration
          continue;
        }

        // Not a rate limit error - throw immediately
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
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
