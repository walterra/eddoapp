import { randomBytes, randomInt } from 'crypto';

/**
 * Generate an unbiased random integer in the range [0, max).
 * Uses crypto.randomInt which implements rejection sampling internally.
 * @param max - Exclusive upper bound (must be <= 2^48)
 */
export function getRandomInt(max: number): number {
  return randomInt(max);
}

/**
 * Generate a cryptographically secure random hex string.
 * @param byteLength - Number of random bytes (output will be 2x this length in hex)
 */
export function getRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}
