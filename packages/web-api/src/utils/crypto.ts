/**
 * Cryptographic utility functions for password hashing and token generation
 */
import { getRandomHex } from '@eddo/core-shared';
import bcrypt from 'bcryptjs';

/**
 * Number of salt rounds for bcrypt hashing
 * 12 rounds provides a good balance of security and performance
 */
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  return getRandomHex(16);
}
