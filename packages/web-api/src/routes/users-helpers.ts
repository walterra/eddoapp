/**
 * Helper functions for user routes
 */
import type { UserRegistryEntry } from '@eddo/core-shared';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { validateEmail, validatePassword } from '../utils/validation.js';

interface JwtTokenPayload {
  userId: string;
  username: string;
  exp: number;
}

/**
 * Extract user from JWT token in Authorization header
 */
export async function extractUserFromToken(
  authHeader: string | undefined,
): Promise<JwtTokenPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Create safe profile response (without sensitive data)
 */
export function createSafeProfile(user: UserRegistryEntry): {
  userId: string;
  username: string;
  email?: string;
  telegramId?: number;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  status: string;
  preferences: UserRegistryEntry['preferences'];
} {
  return {
    userId: user._id,
    username: user.username,
    email: user.email,
    telegramId: user.telegram_id,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    permissions: user.permissions,
    status: user.status,
    preferences: user.preferences,
  };
}

/**
 * Validate email update request
 */
export async function validateEmailUpdate(
  newEmail: string,
  user: UserRegistryEntry,
  findByEmail: (email: string) => Promise<UserRegistryEntry | null>,
): Promise<{ valid: boolean; error?: string }> {
  if (!validateEmail(newEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  const existingEmail = await findByEmail(newEmail);
  if (existingEmail && existingEmail._id !== user._id) {
    return { valid: false, error: 'Email already in use' };
  }

  return { valid: true };
}

/**
 * Validate and hash password update
 */
export async function validatePasswordUpdate(
  currentPassword: string,
  newPassword: string,
  currentHash: string,
): Promise<{ valid: boolean; hash?: string; error?: string }> {
  // Verify current password
  const isCurrentPasswordValid = await verifyPassword(currentPassword, currentHash);
  if (!isCurrentPasswordValid) {
    return { valid: false, error: 'Current password is incorrect' };
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return { valid: false, error: passwordValidation.errors.join(', ') };
  }

  // Hash new password
  const hash = await hashPassword(newPassword);
  return { valid: true, hash };
}

/**
 * Check if user is valid for operations
 */
export function validateUserAccess(user: UserRegistryEntry | null): {
  valid: boolean;
  error?: string;
  status?: 403 | 404;
} {
  if (!user) {
    return { valid: false, error: 'User not found', status: 404 };
  }

  if (user.status !== 'active') {
    return { valid: false, error: 'Account is suspended', status: 403 };
  }

  return { valid: true };
}
