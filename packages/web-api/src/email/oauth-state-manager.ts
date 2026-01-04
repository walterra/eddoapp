/**
 * OAuth State Manager
 * Manages pending OAuth authorization states with expiration
 */
import type { OAuthState } from './types.js';

/** State manager configuration */
export interface OAuthStateManagerConfig {
  /** State expiration time in milliseconds (default: 10 minutes) */
  expirationMs?: number;
  /** Cleanup interval in milliseconds (default: 1 minute) */
  cleanupIntervalMs?: number;
}

/** OAuth state manager interface */
export interface OAuthStateManager {
  /** Create and store a new OAuth state */
  create(userId: string, telegramChatId: number): OAuthState;
  /** Validate and consume a state (removes it after validation) */
  validate(state: string): OAuthState | null;
  /** Get state without consuming it */
  get(state: string): OAuthState | null;
  /** Remove a state */
  remove(state: string): void;
  /** Stop cleanup interval */
  stop(): void;
}

const DEFAULT_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Generates a cryptographically random state string
 */
function generateStateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if a state has expired
 */
function isExpired(state: OAuthState, expirationMs: number): boolean {
  const createdAt = new Date(state.createdAt).getTime();
  return Date.now() - createdAt > expirationMs;
}

/**
 * Creates cleanup function for expired states
 */
function createCleanupFn(states: Map<string, OAuthState>, expirationMs: number) {
  return () => {
    for (const [key, state] of states) {
      if (isExpired(state, expirationMs)) {
        states.delete(key);
      }
    }
  };
}

/**
 * Creates state creation function
 */
function createStateFn(states: Map<string, OAuthState>) {
  return (userId: string, telegramChatId: number): OAuthState => {
    const state: OAuthState = {
      userId,
      telegramChatId,
      state: generateStateToken(),
      createdAt: new Date().toISOString(),
    };
    states.set(state.state, state);
    return state;
  };
}

/**
 * Creates state validation function
 */
function createValidateFn(states: Map<string, OAuthState>, expirationMs: number) {
  return (stateToken: string): OAuthState | null => {
    const state = states.get(stateToken);
    if (!state) return null;
    if (isExpired(state, expirationMs)) {
      states.delete(stateToken);
      return null;
    }
    states.delete(stateToken); // Consume the state
    return state;
  };
}

/**
 * Creates state getter function
 */
function createGetFn(states: Map<string, OAuthState>, expirationMs: number) {
  return (stateToken: string): OAuthState | null => {
    const state = states.get(stateToken);
    if (!state) return null;
    if (isExpired(state, expirationMs)) {
      states.delete(stateToken);
      return null;
    }
    return state;
  };
}

/**
 * Creates an OAuth state manager for tracking authorization flows
 */
export function createOAuthStateManager(config: OAuthStateManagerConfig = {}): OAuthStateManager {
  const expirationMs = config.expirationMs ?? DEFAULT_EXPIRATION_MS;
  const cleanupIntervalMs = config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

  const states = new Map<string, OAuthState>();
  const cleanupInterval = setInterval(createCleanupFn(states, expirationMs), cleanupIntervalMs);
  cleanupInterval.unref();

  return {
    create: createStateFn(states),
    validate: createValidateFn(states, expirationMs),
    get: createGetFn(states, expirationMs),
    remove: (stateToken: string) => states.delete(stateToken),
    stop: () => {
      clearInterval(cleanupInterval);
      states.clear();
    },
  };
}
