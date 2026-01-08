/**
 * User Context for Telemetry
 *
 * Sets user attributes on spans for better trace correlation in Kibana.
 * Called after successful authentication.
 */

import { trace } from '@opentelemetry/api';

/** Current user context for telemetry */
interface UserContext {
  userId: string;
  username: string;
}

let currentUserContext: UserContext | null = null;

/**
 * Sets user context for all subsequent spans.
 * Call after successful login.
 * @param username - Authenticated username
 */
export function setTelemetryUser(username: string): void {
  currentUserContext = {
    userId: username, // Use username as ID since we don't have separate user IDs
    username,
  };
}

/**
 * Clears user context.
 * Call on logout.
 */
export function clearTelemetryUser(): void {
  currentUserContext = null;
}

/**
 * Gets current user context.
 * @returns User context or null if not authenticated
 */
export function getTelemetryUser(): UserContext | null {
  return currentUserContext;
}

/**
 * Adds user attributes to the current active span.
 * Safe to call even if no active span exists.
 */
export function addUserToActiveSpan(): void {
  if (!currentUserContext) return;

  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('user.id', currentUserContext.userId);
    span.setAttribute('user.name', currentUserContext.username);
  }
}
