/**
 * Helper functions for authentication routes
 */
import type { UserRegistryOperations } from '@eddo/core-shared';

import { validateEmail, validatePassword, validateUsername } from '../utils/crypto.js';

export interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  telegramId?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate registration input fields
 */
export function validateRegistrationInput(input: RegistrationInput): ValidationResult {
  const usernameValidation = validateUsername(input.username);
  if (!usernameValidation.isValid) {
    return { valid: false, error: usernameValidation.errors.join(', ') };
  }

  if (!validateEmail(input.email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.isValid) {
    return { valid: false, error: passwordValidation.errors.join(', ') };
  }

  return { valid: true };
}

/**
 * Check if username, email, or telegram ID already exist
 */
export async function checkExistingUser(
  userRegistry: UserRegistryOperations,
  input: RegistrationInput,
): Promise<ValidationResult> {
  const existingUser = await userRegistry.findByUsername(input.username);
  if (existingUser) {
    return { valid: false, error: 'Username already exists' };
  }

  const existingEmail = await userRegistry.findByEmail(input.email);
  if (existingEmail) {
    return { valid: false, error: 'Email already registered' };
  }

  if (input.telegramId) {
    const existingTelegram = await userRegistry.findByTelegramId(input.telegramId);
    if (existingTelegram) {
      return { valid: false, error: 'Telegram ID already registered' };
    }
  }

  return { valid: true };
}

interface LinkingCodeData {
  username: string;
  expires: number;
}

// In-memory store for linking codes (in production, use Redis or database)
const linkingCodes = new Map<string, LinkingCodeData>();

/**
 * Store a linking code
 */
export function storeLinkingCode(linkCode: string, username: string): void {
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  linkingCodes.set(linkCode, { username, expires });

  // Clean up expired codes
  for (const [code, data] of linkingCodes.entries()) {
    if (Date.now() > data.expires) {
      linkingCodes.delete(code);
    }
  }
}

/**
 * Get and validate a linking code
 */
export function getLinkingCode(linkCode: string): {
  valid: boolean;
  username?: string;
  error?: string;
} {
  const linkData = linkingCodes.get(linkCode);

  if (!linkData) {
    return { valid: false, error: 'Invalid or expired link code' };
  }

  if (Date.now() > linkData.expires) {
    linkingCodes.delete(linkCode);
    return { valid: false, error: 'Link code expired' };
  }

  return { valid: true, username: linkData.username };
}

/**
 * Delete a linking code
 */
export function deleteLinkingCode(linkCode: string): void {
  linkingCodes.delete(linkCode);
}
