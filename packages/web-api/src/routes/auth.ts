import { createEnv, createUserRegistry } from '@eddo/core-server';
import { createDefaultUserPreferences } from '@eddo/core-shared';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config';
import { generateSecureToken, hashPassword, verifyPassword } from '../utils/crypto.js';
import { logger, withSpan } from '../utils/logger';
import { setupUserDatabase } from '../utils/setup-user-db';
import {
  checkExistingUser,
  deleteLinkingCode,
  getLinkingCode,
  storeLinkingCode,
  validateRegistrationInput,
} from './auth-helpers';

const authApp = new Hono();

const env = createEnv();
const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

const TOKEN_EXPIRATION_SHORT = 1 * 60 * 60;
const TOKEN_EXPIRATION_LONG = 30 * 24 * 60 * 60;

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  telegramId: z.number().optional(),
  rememberMe: z.boolean().optional().default(false),
});

const linkTelegramSchema = z.object({
  linkCode: z.string().min(1),
  telegramId: z.number(),
});

interface JwtTokenPayload {
  userId: string;
  username: string;
  exp: number;
}

function createToken(userId: string, username: string, expiration: number): string {
  return jwt.sign(
    { userId, username, exp: Math.floor(Date.now() / 1000) + expiration },
    config.jwtSecret,
  );
}

interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  telegramId?: number;
}

/** Creates a new user in the registry */
async function createNewUser(input: RegistrationInput): Promise<{ _id: string; username: string }> {
  const passwordHash = await hashPassword(input.password);

  return userRegistry.create({
    username: input.username,
    email: input.email,
    password_hash: passwordHash,
    telegram_id: input.telegramId,
    database_name: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: ['read', 'write'],
    status: 'active',
    version: 'alpha2',
    preferences: createDefaultUserPreferences(),
  });
}

authApp.post('/register', async (c) => {
  return withSpan('auth_register', { 'auth.operation': 'register' }, async (span) => {
    try {
      const body = await c.req.json();
      const { username, email, password, telegramId, rememberMe } = registerSchema.parse(body);
      const tokenExpiration = rememberMe ? TOKEN_EXPIRATION_LONG : TOKEN_EXPIRATION_SHORT;

      span.setAttribute('user.name', username);

      const inputValidation = validateRegistrationInput({ username, email, password, telegramId });
      if (!inputValidation.valid) {
        span.setAttribute('auth.result', 'validation_failed');
        return c.json({ error: inputValidation.error }, 400);
      }

      const existingCheck = await checkExistingUser(userRegistry, {
        username,
        email,
        password,
        telegramId,
      });
      if (!existingCheck.valid) {
        span.setAttribute('auth.result', 'user_exists');
        return c.json({ error: existingCheck.error }, 409);
      }

      const user = await createNewUser({ username, email, password, telegramId });
      await setupUserDatabase(username);
      const token = createToken(user._id, user.username, tokenExpiration);

      span.setAttribute('auth.result', 'success');
      span.setAttribute('user.id', user._id);
      logger.info({ username, userId: user._id }, 'User registered successfully');

      return c.json({
        token,
        username: user.username,
        userId: user._id,
        expiresIn: rememberMe ? '30d' : '1h',
      });
    } catch (error) {
      span.setAttribute('auth.result', 'error');
      logger.error({ error }, 'Registration error');
      return c.json({ error: 'Registration failed' }, 500);
    }
  });
});

/** Handle login for registered users */
async function handleRegisteredUserLogin(
  user: { _id: string; username: string; password_hash: string; status: string },
  password: string,
  tokenExpiration: number,
  expiresInLabel: string,
): Promise<
  { success: true; response: object } | { success: false; error: string; status: number }
> {
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) return { success: false, error: 'Invalid credentials', status: 401 };
  if (user.status !== 'active')
    return { success: false, error: 'Account is suspended', status: 403 };

  const token = createToken(user._id, user.username, tokenExpiration);
  return {
    success: true,
    response: { token, username: user.username, userId: user._id, expiresIn: expiresInLabel },
  };
}

/** Check if demo credentials are valid */
function isValidDemoCredentials(username: string, password: string): boolean {
  if (username === 'demo' && password === 'password') return true;
  const url = new URL(config.couchdb.url);
  return username === url.username && password === url.password;
}

authApp.post('/login', async (c) => {
  return withSpan('auth_login', { 'auth.operation': 'login' }, async (span) => {
    try {
      const body = await c.req.json();
      const { username, password, rememberMe } = loginSchema.parse(body);
      const tokenExpiration = rememberMe ? TOKEN_EXPIRATION_LONG : TOKEN_EXPIRATION_SHORT;
      const expiresInLabel = rememberMe ? '30d' : '1h';

      span.setAttribute('user.name', username);

      const user = await userRegistry.findByUsername(username);
      if (user) {
        const result = await handleRegisteredUserLogin(
          user,
          password,
          tokenExpiration,
          expiresInLabel,
        );
        if (!result.success) {
          span.setAttribute('auth.result', 'invalid_credentials');
          return c.json({ error: result.error }, result.status as 401 | 403);
        }
        span.setAttribute('auth.result', 'success');
        span.setAttribute('user.id', user._id);
        logger.info({ username, userId: user._id }, 'User logged in');
        return c.json(result.response);
      }

      // Fallback to demo authentication for backward compatibility
      if (!isValidDemoCredentials(username, password)) {
        span.setAttribute('auth.result', 'invalid_credentials');
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      span.setAttribute('auth.result', 'demo_login');
      const token = createToken(`demo_${username}`, username, tokenExpiration);
      return c.json({ token, username, userId: `demo_${username}`, expiresIn: expiresInLabel });
    } catch (error) {
      span.setAttribute('auth.result', 'error');
      logger.error({ error }, 'Login error');
      return c.json({ error: 'Invalid request' }, 400);
    }
  });
});

authApp.get('/validate', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;
    return c.json({
      valid: true,
      userId: decoded.userId,
      username: decoded.username,
      exp: decoded.exp,
    });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

authApp.post('/generate-link-code', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;
    const linkCode = generateSecureToken();
    storeLinkingCode(linkCode, decoded.username);

    return c.json({ linkCode, expiresIn: '5 minutes' });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

authApp.post('/link-telegram', async (c) => {
  return withSpan('auth_link_telegram', { 'auth.operation': 'link_telegram' }, async (span) => {
    try {
      const body = await c.req.json();
      const { linkCode, telegramId } = linkTelegramSchema.parse(body);

      span.setAttribute('telegram.id', telegramId);

      const linkResult = getLinkingCode(linkCode);
      if (!linkResult.valid) {
        span.setAttribute('auth.result', 'invalid_code');
        return c.json({ error: linkResult.error }, 400);
      }

      const existingTelegram = await userRegistry.findByTelegramId(telegramId);
      if (existingTelegram) {
        span.setAttribute('auth.result', 'already_linked');
        return c.json({ error: 'Telegram ID already linked to another account' }, 409);
      }

      const user = await userRegistry.findByUsername(linkResult.username!);
      if (!user) {
        span.setAttribute('auth.result', 'user_not_found');
        return c.json({ error: 'User not found' }, 404);
      }

      await userRegistry.update(user._id, { telegram_id: telegramId });
      deleteLinkingCode(linkCode);

      span.setAttribute('auth.result', 'success');
      span.setAttribute('user.name', linkResult.username!);
      logger.info({ username: linkResult.username, telegramId }, 'Telegram account linked');

      return c.json({ success: true, username: linkResult.username });
    } catch (error) {
      span.setAttribute('auth.result', 'error');
      logger.error({ error }, 'Telegram linking error');
      return c.json({ error: 'Linking failed' }, 500);
    }
  });
});

export { authApp as authRoutes };
