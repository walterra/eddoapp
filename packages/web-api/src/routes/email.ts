/**
 * Email OAuth routes for Gmail authentication
 */
import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Hono } from 'hono';

import { createGoogleOAuthClient } from '../email/oauth';
import { createOAuthStateManager, type OAuthStateManager } from '../email/oauth-state-manager';
import type { OAuthTokenResponse } from '../email/types';
import { logger as baseLogger } from '../utils/logger';

const logger = baseLogger.child({ component: 'email-oauth' });

export const emailRoutes = new Hono();

// Singleton state manager for OAuth flows
let stateManager: OAuthStateManager | null = null;

/** Get or create the OAuth state manager */
export function getOAuthStateManager(): OAuthStateManager {
  if (!stateManager) {
    stateManager = createOAuthStateManager();
  }
  return stateManager;
}

/** Render error HTML page */
function errorHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
  <head><title>${title}</title></head>
  <body style="font-family: sans-serif; padding: 40px; text-align: center;">
    <h1>❌ ${title}</h1>
    <p>${message}</p>
    <p>Please try again via Telegram using /email auth</p>
  </body>
</html>`;
}

/** Render success HTML page */
function successHtml(email: string): string {
  return `<!DOCTYPE html>
<html>
  <head><title>Email Connected</title></head>
  <body style="font-family: sans-serif; padding: 40px; text-align: center;">
    <h1>✅ Email Connected!</h1>
    <p>Your Gmail account <strong>${email}</strong> has been connected.</p>
    <p>Emails from your "eddo" folder will be synced to your todos.</p>
    <p>You can close this window now.</p>
  </body>
</html>`;
}

/** Fetch user email from Google */
async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info from Google');
  }

  const userInfo = (await response.json()) as { email: string };
  return userInfo.email;
}

/** Exchange OAuth code for tokens */
async function exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
  const env = createEnv();
  const oauthClient = createGoogleOAuthClient({
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: env.GOOGLE_REDIRECT_URI || '',
  });

  const tokens = await oauthClient.exchangeCode(code);
  if (!tokens.accessToken) {
    throw new Error('No access token received from Google');
  }
  return tokens;
}

/** Save email config to user preferences */
async function saveEmailConfig(userId: string, tokens: OAuthTokenResponse, email: string) {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  const username = userId.replace('user_', '');
  const existingUser = await userRegistry.findByUsername(username);
  if (!existingUser) {
    throw new Error('User not found');
  }

  const updatedPreferences = {
    ...existingUser.preferences,
    emailSync: true,
    emailConfig: {
      provider: 'gmail' as const,
      oauthRefreshToken: tokens.refreshToken || undefined,
      oauthEmail: email,
    },
  };

  await userRegistry.update(userId, { preferences: updatedPreferences });
}

/** Generate OAuth authorization URL (called by telegram-bot) */
emailRoutes.post('/oauth/generate-url', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, telegramChatId } = body as { userId: string; telegramChatId: number };

    if (!userId || !telegramChatId) {
      return c.json({ error: 'Missing userId or telegramChatId' }, 400);
    }

    const env = createEnv();

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return c.json({ error: 'Google OAuth not configured' }, 500);
    }

    const oauthClient = createGoogleOAuthClient({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });

    const manager = getOAuthStateManager();
    const stateData = manager.create(userId, telegramChatId);
    const authUrl = oauthClient.generateAuthUrl(stateData.state);

    logger.info({ userId, telegramChatId }, 'OAuth URL generated');

    return c.json({ authUrl });
  } catch (err) {
    logger.error({ error: err }, 'Failed to generate OAuth URL');
    return c.json({ error: 'Failed to generate authorization URL' }, 500);
  }
});

/** Handle OAuth callback from Google */
emailRoutes.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    logger.error({ error }, 'OAuth error from Google');
    return c.html(errorHtml('Connection Failed', `Google returned an error: ${error}`));
  }

  if (!code || !state) {
    logger.error({ code: !!code, state: !!state }, 'Missing OAuth parameters');
    return c.html(errorHtml('Invalid Request', 'Missing required OAuth parameters.'));
  }

  const manager = getOAuthStateManager();
  const stateData = manager.validate(state);

  if (!stateData) {
    logger.error({ state }, 'Invalid or expired OAuth state');
    return c.html(errorHtml('Session Expired', 'The authentication session has expired.'));
  }

  const { userId } = stateData;
  logger.info({ userId }, 'Processing OAuth callback');

  try {
    const tokens = await exchangeCodeForTokens(code);
    const oauthEmail = await fetchGoogleUserEmail(tokens.accessToken);

    logger.info(
      {
        userId,
        oauthEmail,
        hasRefreshToken: !!tokens.refreshToken,
        hasAccessToken: !!tokens.accessToken,
      },
      'OAuth tokens received, updating user preferences',
    );

    await saveEmailConfig(userId, tokens, oauthEmail);

    logger.info({ userId, oauthEmail }, 'Email OAuth configuration saved');
    return c.html(successHtml(oauthEmail));
  } catch (err) {
    logger.error({ error: err }, 'OAuth callback error');
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return c.html(errorHtml('Connection Error', message));
  }
});
