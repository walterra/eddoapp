/**
 * Input validation functions for user registration and authentication
 */

/**
 * Reserved usernames that cannot be used for registration.
 * These could cause database naming collisions or security issues.
 */
export const RESERVED_USERNAMES = [
  'registry', // Collides with eddo_user_registry database
  'admin',
  'administrator',
  'root',
  'system',
  'null',
  'undefined',
  'api',
  'www',
  'mail',
  'support',
  'help',
  'info',
] as const;

export type ReservedUsername = (typeof RESERVED_USERNAMES)[number];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a username is reserved
 */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase() as ReservedUsername);
}

/**
 * Validate username format and ensure it's not reserved
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 20) {
    errors.push('Username must be no more than 20 characters long');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (!/^[a-zA-Z]/.test(username)) {
    errors.push('Username must start with a letter');
  }

  if (isReservedUsername(username)) {
    errors.push('This username is reserved and cannot be used');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
