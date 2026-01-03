import { createEnv, createUserRegistry, getUserRegistryDatabaseConfig } from '@eddo/core-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import jwt from 'jsonwebtoken';
import nano from 'nano';
import { z } from 'zod';

import { getGithubScheduler } from '../index';
import { logger, withSpan } from '../utils/logger';
import {
  createSafeProfile,
  extractUserFromToken,
  validateEmailUpdate,
  validatePasswordUpdate,
  validateUserAccess,
} from './users-helpers';
import {
  changePasswordSchema,
  linkTelegramSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from './users-schemas';

const usersApp = new Hono();

// Initialize environment and user registry
const env = createEnv();
const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

// Initialize nano connection for changes feed
const couchConnection = nano(env.COUCHDB_URL);
const registryDbConfig = getUserRegistryDatabaseConfig(env);
const registryDb = couchConnection.db.use(registryDbConfig.dbName);

// Validation schemas
// Get current user profile
usersApp.get('/profile', async (c) => {
  return withSpan('user_get_profile', { 'user.operation': 'get_profile' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    span.setAttribute('user.name', userToken.username);

    try {
      const user = await userRegistry.findByUsername(userToken.username);
      const access = validateUserAccess(user);
      if (!access.valid) return c.json({ error: access.error }, access.status!);

      span.setAttribute('user.id', user!._id);
      return c.json(createSafeProfile(user!));
    } catch (error) {
      logger.error({ error }, 'Profile fetch error');
      return c.json({ error: 'Failed to fetch profile' }, 500);
    }
  });
});

// Update user profile
usersApp.put('/profile', async (c) => {
  return withSpan('user_update_profile', { 'user.operation': 'update_profile' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    span.setAttribute('user.name', userToken.username);

    try {
      const body = await c.req.json();
      const { email, currentPassword, newPassword } = updateProfileSchema.parse(body);

      const user = await userRegistry.findByUsername(userToken.username);
      const access = validateUserAccess(user);
      if (!access.valid) return c.json({ error: access.error }, access.status!);

      span.setAttribute('user.id', user!._id);

      const updates: Record<string, unknown> = {};

      // Update email if provided
      if (email && email !== user!.email) {
        const emailValidation = await validateEmailUpdate(email, user!, userRegistry.findByEmail);
        if (!emailValidation.valid) return c.json({ error: emailValidation.error }, 400);
        updates.email = email;
        span.setAttribute('user.email_updated', true);
      }

      // Update password if provided
      if (newPassword) {
        if (!currentPassword) {
          return c.json({ error: 'Current password required to change password' }, 400);
        }
        const pwValidation = await validatePasswordUpdate(
          currentPassword,
          newPassword,
          user!.password_hash,
        );
        if (!pwValidation.valid) return c.json({ error: pwValidation.error }, 400);
        updates.password_hash = pwValidation.hash;
        span.setAttribute('user.password_updated', true);
      }

      updates.updated_at = new Date().toISOString();
      const updatedUser = await userRegistry.update(user!._id, updates);

      logger.info({ username: userToken.username }, 'Profile updated');
      return c.json(createSafeProfile(updatedUser));
    } catch (error) {
      logger.error({ error }, 'Profile update error');
      return c.json({ error: 'Failed to update profile' }, 500);
    }
  });
});

// Change password (dedicated endpoint)
usersApp.post('/change-password', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    const pwValidation = await validatePasswordUpdate(
      currentPassword,
      newPassword,
      user!.password_hash,
    );
    if (!pwValidation.valid) return c.json({ error: pwValidation.error }, 400);

    await userRegistry.update(user!._id, {
      password_hash: pwValidation.hash,
      updated_at: new Date().toISOString(),
    });

    return c.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error({ error }, 'Password change error');
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// Link Telegram account manually
usersApp.post('/telegram-link', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const body = await c.req.json();
    const { telegramId } = linkTelegramSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    if (user!.telegram_id) {
      return c.json({ error: 'Telegram account already linked' }, 400);
    }

    const existingTelegram = await userRegistry.findByTelegramId(telegramId);
    if (existingTelegram) {
      return c.json({ error: 'Telegram ID already linked to another account' }, 409);
    }

    await userRegistry.update(user!._id, {
      telegram_id: telegramId,
      updated_at: new Date().toISOString(),
    });

    return c.json({ success: true, message: 'Telegram account linked successfully', telegramId });
  } catch (error) {
    logger.error({ error }, 'Telegram link error');
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid Telegram ID format' }, 400);
    }
    return c.json({ error: 'Failed to link Telegram account' }, 500);
  }
});

// Unlink Telegram account
usersApp.delete('/telegram-link', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    if (!user!.telegram_id) {
      return c.json({ error: 'No Telegram account linked' }, 400);
    }

    await userRegistry.update(user!._id, {
      telegram_id: undefined,
      updated_at: new Date().toISOString(),
    });

    return c.json({ success: true, message: 'Telegram account unlinked successfully' });
  } catch (error) {
    logger.error({ error }, 'Telegram unlink error');
    return c.json({ error: 'Failed to unlink Telegram account' }, 500);
  }
});

// Update user preferences
usersApp.put('/preferences', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const body = await c.req.json();
    const preferences = updatePreferencesSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    const updatedUser = await userRegistry.update(user!._id, {
      preferences: { ...user!.preferences, ...preferences },
      updated_at: new Date().toISOString(),
    });

    return c.json({ success: true, preferences: updatedUser.preferences });
  } catch (error) {
    logger.error({ error }, 'Preferences update error');
    if (error instanceof z.ZodError) return c.json({ error: 'Invalid preferences format' }, 400);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

// SSE endpoint for real-time preference updates
usersApp.get('/preferences/stream', async (c) => {
  const { handlePreferencesStream } = await import('./users-sse');
  const payload = c.get('jwtPayload') as jwt.JwtPayload;
  const username = payload.username;
  const docId = `user_${username}`;

  logger.debug({ username }, 'Starting SSE preferences stream');

  return streamSSE(c, async (stream) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handlePreferencesStream({
      stream,
      username,
      docId,
      registryDb: registryDb as any,
      createSafeProfile,
    });
  });
});

// Force GitHub sync
usersApp.post('/github-resync', async (c) => {
  return withSpan('github_force_resync', { 'github.operation': 'force_resync' }, async (span) => {
    try {
      const payload = c.get('jwtPayload') as jwt.JwtPayload;
      const userId = `user_${payload.username}`;

      span.setAttribute('user.id', userId);
      span.setAttribute('user.name', payload.username);
      logger.info({ userId, username: payload.username }, 'Force GitHub resync requested');

      const scheduler = getGithubScheduler();
      await scheduler.syncUser(userId, true);

      span.setAttribute('github.result', 'success');
      logger.info({ userId, username: payload.username }, 'GitHub resync completed');

      return c.json({ success: true, message: 'GitHub resync completed successfully' });
    } catch (error) {
      span.setAttribute('github.result', 'error');
      logger.error({ error }, 'GitHub resync error');

      if (error instanceof Error && error.message.includes('rate limit')) {
        const rateLimitError = error as Error & { resetTime?: string };
        span.setAttribute('github.rate_limited', true);
        return c.json(
          {
            error: rateLimitError.message,
            rateLimitError: true,
            resetTime: rateLimitError.resetTime,
          },
          429,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to resync GitHub issues';
      return c.json({ error: errorMessage }, 500);
    }
  });
});

export { usersApp as userRoutes };
