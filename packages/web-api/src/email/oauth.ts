/**
 * Google OAuth handler for Gmail IMAP access
 * Handles authorization URL generation, token exchange, and refresh
 */
import { OAuth2Client } from 'google-auth-library';

import type { OAuthTokenResponse } from './types.js';

/** OAuth configuration */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** OAuth client interface */
export interface GoogleOAuthClient {
  /** Generate authorization URL for user consent */
  generateAuthUrl(state: string): string;
  /** Exchange authorization code for tokens */
  exchangeCode(code: string): Promise<OAuthTokenResponse>;
  /** Refresh access token using refresh token */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>;
  /** Verify configuration is valid */
  isConfigured(): boolean;
}

/** Gmail IMAP scope required for full mailbox access */
const GMAIL_IMAP_SCOPE = 'https://mail.google.com/';

/** Additional scopes for user info */
const EMAIL_SCOPE = 'email';
const PROFILE_SCOPE = 'profile';

/** Google token data for conversion */
interface GoogleTokenData {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  tokenType?: string | null;
  fallbackRefreshToken?: string;
}

/**
 * Converts Google token response to OAuthTokenResponse
 */
function toOAuthTokenResponse(data: GoogleTokenData): OAuthTokenResponse {
  const { accessToken, refreshToken, expiryDate, tokenType, fallbackRefreshToken } = data;
  return {
    accessToken,
    refreshToken: refreshToken || fallbackRefreshToken,
    expiresIn: expiryDate ? Math.floor((expiryDate - Date.now()) / 1000) : 3600,
    tokenType: tokenType || 'Bearer',
  };
}

/**
 * Creates exchange code handler
 */
function createExchangeCode(getClient: () => OAuth2Client) {
  return async (code: string): Promise<OAuthTokenResponse> => {
    const client = getClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    return toOAuthTokenResponse({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type,
    });
  };
}

/**
 * Creates refresh token handler
 */
function createRefreshAccessToken(getClient: () => OAuth2Client) {
  return async (refreshToken: string): Promise<OAuthTokenResponse> => {
    const client = getClient();
    client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    return toOAuthTokenResponse({
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiryDate: credentials.expiry_date,
      tokenType: credentials.token_type,
      fallbackRefreshToken: refreshToken,
    });
  };
}

/**
 * Creates Google OAuth client for Gmail IMAP access
 * @param config OAuth configuration with client credentials
 * @returns OAuth client instance
 */
export function createGoogleOAuthClient(config: Partial<OAuthConfig>): GoogleOAuthClient {
  const { clientId, clientSecret, redirectUri } = config;

  const isConfigured = (): boolean => Boolean(clientId && clientSecret && redirectUri);

  const getOAuth2Client = (): OAuth2Client => {
    if (!isConfigured()) {
      throw new Error('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
    return new OAuth2Client(clientId, clientSecret, redirectUri);
  };

  const generateAuthUrl = (state: string): string => {
    return getOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GMAIL_IMAP_SCOPE, EMAIL_SCOPE, PROFILE_SCOPE],
      state,
    });
  };

  return {
    isConfigured,
    generateAuthUrl,
    exchangeCode: createExchangeCode(getOAuth2Client),
    refreshAccessToken: createRefreshAccessToken(getOAuth2Client),
  };
}

/**
 * Generates a random state string for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Masks OAuth token for logging (shows first 7 and last 4 chars)
 */
export function maskToken(token: string): string {
  if (token.length <= 15) return '***';
  return `${token.substring(0, 7)}...${token.substring(token.length - 4)}`;
}
