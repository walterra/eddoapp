/**
 * GitHub API rate limit utilities
 * Handles rate limit header extraction, formatting, and monitoring
 */

/**
 * Rate limit information extracted from GitHub API response headers
 */
export interface RateLimitInfo {
  limit: number; // Total requests allowed per hour
  remaining: number; // Requests remaining in current window
  reset: number; // Unix timestamp when limit resets
  resetDate: Date; // JavaScript Date object for reset time
  used: number; // Requests used in current window
}

/**
 * Rate limit error with reset information
 */
export interface RateLimitError extends Error {
  rateLimitInfo?: RateLimitInfo;
  resetTime?: string; // Human-readable reset time
}

function parseHeaderValue(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return isNaN(num) || num < 0 ? null : num;
}

function extractRequiredHeaders(
  headers: Record<string, string | number | undefined>,
): { limit: number; remaining: number; reset: number; used: number } | null {
  const limit = parseHeaderValue(headers['x-ratelimit-limit']);
  const remaining = parseHeaderValue(headers['x-ratelimit-remaining']);
  const reset = parseHeaderValue(headers['x-ratelimit-reset']);
  const used = parseHeaderValue(headers['x-ratelimit-used']);

  if (limit === null || remaining === null || reset === null || used === null) {
    return null;
  }

  return { limit, remaining, reset, used };
}

/**
 * Extracts rate limit information from GitHub API response headers
 * Headers: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-ratelimit-used
 * @param headers Response headers from GitHub API
 * @returns Rate limit info or null if headers not present
 */
export function extractRateLimitHeaders(
  headers: Record<string, string | number | undefined>,
): RateLimitInfo | null {
  const parsed = extractRequiredHeaders(headers);
  if (!parsed) return null;

  return {
    limit: parsed.limit,
    remaining: parsed.remaining,
    reset: parsed.reset,
    resetDate: new Date(parsed.reset * 1000),
    used: parsed.used,
  };
}

/**
 * Type guard to check if error is a rate limit error
 * @param error Error object to check
 * @returns True if error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('api rate limit exceeded')
  );
}

/**
 * Formats reset time as human-readable string
 * Examples:
 * - "in 5 minutes" (if < 1 hour away)
 * - "at 3:45 PM" (if today)
 * - "tomorrow at 2:30 AM" (if tomorrow)
 * - "on Dec 23 at 10:15 AM" (if future date)
 * @param resetDate Date when rate limit resets
 * @returns Formatted time string
 */
export function formatResetTime(resetDate: Date): string {
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  const diffMinutes = Math.ceil(diffMs / 60000);

  // Already passed (should not happen, but handle gracefully)
  if (diffMs < 0) {
    return 'now (limit should be reset)';
  }

  // Less than 1 minute
  if (diffMinutes < 1) {
    return 'in less than a minute';
  }

  // Less than 1 hour - show minutes
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  }

  // Less than 24 hours - show time today
  const isToday = resetDate.toDateString() === now.toDateString();
  if (isToday) {
    const timeStr = resetDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `at ${timeStr}`;
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = resetDate.toDateString() === tomorrow.toDateString();
  if (isTomorrow) {
    const timeStr = resetDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `tomorrow at ${timeStr}`;
  }

  // Future date
  const dateStr = resetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = resetDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `on ${dateStr} at ${timeStr}`;
}

/**
 * Checks if rate limit is approaching threshold and should trigger warning
 * Default threshold: 20% of limit remaining
 * @param rateLimitInfo Rate limit information
 * @param thresholdPercent Warning threshold as percentage (0-100)
 * @returns True if warning should be triggered
 */
export function shouldWarnAboutRateLimit(
  rateLimitInfo: RateLimitInfo,
  thresholdPercent = 20,
): boolean {
  if (rateLimitInfo.limit === 0) {
    return false;
  }

  const percentRemaining = (rateLimitInfo.remaining / rateLimitInfo.limit) * 100;
  return percentRemaining <= thresholdPercent && rateLimitInfo.remaining > 0;
}

/**
 * Calculates percentage of rate limit remaining
 * @param rateLimitInfo Rate limit information
 * @returns Percentage remaining (0-100)
 */
export function getRateLimitPercentage(rateLimitInfo: RateLimitInfo): number {
  if (rateLimitInfo.limit === 0) {
    return 0;
  }

  return Math.round((rateLimitInfo.remaining / rateLimitInfo.limit) * 100);
}
