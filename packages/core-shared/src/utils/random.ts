/**
 * Generate an unbiased random integer in the range [0, max).
 * Uses rejection sampling for unbiased distribution.
 * @param max - Exclusive upper bound (must be <= 2^32)
 */
export function getRandomInt(max: number): number {
  if (max <= 0 || max > 0x100000000) {
    throw new RangeError('max must be > 0 and <= 2^32');
  }

  // Use rejection sampling for unbiased distribution
  const randomBuffer = new Uint32Array(1);
  const maxValid = Math.floor(0x100000000 / max) * max;

  let randomValue: number;
  do {
    crypto.getRandomValues(randomBuffer);
    randomValue = randomBuffer[0];
  } while (randomValue >= maxValid);

  return randomValue % max;
}

/**
 * Generate a cryptographically secure random hex string.
 * @param byteLength - Number of random bytes (output will be 2x this length in hex)
 */
export function getRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
