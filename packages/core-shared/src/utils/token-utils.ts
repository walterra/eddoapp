/**
 * Decodes a JWT token and extracts the payload
 * @param token - The JWT token string
 * @returns The decoded payload or null if invalid
 */
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

/**
 * Checks if a JWT token has expired
 * @param token - The JWT token string
 * @returns true if the token is expired or invalid, false otherwise
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== 'number') {
    return true; // Treat invalid/malformed tokens as expired
  }

  // JWT exp is in seconds, convert to milliseconds
  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime;
};

/**
 * Gets the expiration date of a JWT token
 * @param token - The JWT token string
 * @returns The expiration date or null if invalid
 */
export const getTokenExpiration = (token: string): Date | null => {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }

  // JWT exp is in seconds, convert to milliseconds
  return new Date(payload.exp * 1000);
};

/**
 * Gets the remaining time until token expiration in milliseconds
 * @param token - The JWT token string
 * @returns Milliseconds until expiration, or 0 if expired/invalid
 */
export const getTokenTimeRemaining = (token: string): number => {
  const expiration = getTokenExpiration(token);

  if (!expiration) {
    return 0;
  }

  const remaining = expiration.getTime() - Date.now();
  return Math.max(0, remaining);
};
