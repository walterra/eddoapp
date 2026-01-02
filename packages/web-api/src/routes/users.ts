import { createEnv, createUserRegistry, getUserRegistryDatabaseConfig } from '@eddo/core-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import jwt from 'jsonwebtoken';
import nano from 'nano';
import { z } from 'zod';

import { getGithubScheduler } from '../index';
import {
  createSafeProfile,
  extractUserFromToken,
  validateEmailUpdate,
  validatePasswordUpdate,
  validateUserAccess,
} from './users-helpers';

const usersApp = new Hono();

// Initialize environment and user registry
const env = createEnv();
const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

// Initialize nano connection for changes feed
const couchConnection = nano(env.COUCHDB_URL);
const registryDbConfig = getUserRegistryDatabaseConfig(env);
const registryDb = couchConnection.db.use(registryDbConfig.dbName);

// Validation schemas
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const linkTelegramSchema = z.object({
  telegramId: z.number().int().positive(),
});

const updatePreferencesSchema = z.object({
  dailyBriefing: z.boolean().optional(),
  briefingTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  printBriefing: z.boolean().optional(),
  dailyRecap: z.boolean().optional(),
  recapTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  printRecap: z.boolean().optional(),
  timezone: z.string().optional(),
  viewMode: z.enum(['kanban', 'table']).optional(),
  tableColumns: z.array(z.string()).optional(),
  selectedTags: z.array(z.string()).optional(),
  selectedContexts: z.array(z.string()).optional(),
  selectedStatus: z.enum(['all', 'completed', 'incomplete']).optional(),
  selectedTimeRange: z
    .object({
      type: z.enum([
        'current-day',
        'current-week',
        'current-month',
        'current-year',
        'all-time',
        'custom',
      ]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
  currentDate: z.string().optional(),
  githubSync: z.boolean().optional(),
  githubToken: z.string().nullable().optional(),
  githubSyncInterval: z.number().int().positive().optional(),
  githubSyncTags: z.array(z.string()).optional(),
});

// Get current user profile
usersApp.get('/profile', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    return c.json(createSafeProfile(user!));
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Update user profile
usersApp.put('/profile', async (c) => {
  const userToken = await extractUserFromToken(c.req.header('Authorization'));
  if (!userToken) return c.json({ error: 'Authentication required' }, 401);

  try {
    const body = await c.req.json();
    const { email, currentPassword, newPassword } = updateProfileSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    const access = validateUserAccess(user);
    if (!access.valid) return c.json({ error: access.error }, access.status!);

    const updates: Record<string, unknown> = {};

    // Update email if provided
    if (email && email !== user!.email) {
      const emailValidation = await validateEmailUpdate(email, user!, userRegistry.findByEmail);
      if (!emailValidation.valid) return c.json({ error: emailValidation.error }, 400);
      updates.email = email;
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
    }

    updates.updated_at = new Date().toISOString();
    const updatedUser = await userRegistry.update(user!._id, updates);

    return c.json(createSafeProfile(updatedUser));
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
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
    console.error('Password change error:', error);
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
    console.error('Telegram link error:', error);
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
    console.error('Telegram unlink error:', error);
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
    console.error('Preferences update error:', error);
    if (error instanceof z.ZodError) return c.json({ error: 'Invalid preferences format' }, 400);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

interface SSEStream {
  writeSSE: (data: { event?: string; data: string; id?: string }) => Promise<void>;
}

/** Send SSE heartbeat message */
async function sendHeartbeat(stream: SSEStream): Promise<void> {
  await stream.writeSSE({
    event: 'heartbeat',
    data: JSON.stringify({ timestamp: new Date().toISOString() }),
  });
}

/** Send SSE connected message */
async function sendConnectedMessage(stream: SSEStream, docId: string): Promise<void> {
  await stream.writeSSE({
    event: 'connected',
    data: JSON.stringify({ status: 'connected', docId }),
    id: '0',
  });
}

// SSE endpoint for real-time preference updates
usersApp.get('/preferences/stream', async (c) => {
  const payload = c.get('jwtPayload') as jwt.JwtPayload;
  const username = payload.username;
  const docId = `user_${username}`;

  console.log('[SSE] Starting preferences stream for user:', username);

  return streamSSE(c, async (stream) => {
    let isConnected = true;

    stream.onAbort(() => {
      console.log('[SSE] Client disconnected:', username);
      isConnected = false;
      registryDb.changesReader.stop();
    });

    try {
      const changesEmitter = registryDb.changesReader.start({
        includeDocs: true,
        since: 'now',
        selector: { _id: docId },
      });

      await sendConnectedMessage(stream, docId);

      changesEmitter.on('change', async (change) => {
        if (change.id !== docId || !change.doc) return;
        await stream.writeSSE({
          event: 'preference-update',
          data: JSON.stringify(createSafeProfile(change.doc)),
          id: String(change.seq),
        });
      });

      changesEmitter.on('error', (err) => console.error('[SSE] Changes feed error:', err));

      while (isConnected) {
        await stream.sleep(30000);
        if (isConnected) await sendHeartbeat(stream);
      }
    } catch (error) {
      console.error('[SSE] Stream error:', error);
      registryDb.changesReader.stop();
    }
  });
});

// Force GitHub sync
usersApp.post('/github-resync', async (c) => {
  try {
    const payload = c.get('jwtPayload') as jwt.JwtPayload;
    const userId = `user_${payload.username}`;

    console.log('[GitHub Resync] Force resync requested', { userId, username: payload.username });

    const scheduler = getGithubScheduler();
    await scheduler.syncUser(userId, true);

    console.log('[GitHub Resync] Resync completed successfully', {
      userId,
      username: payload.username,
    });

    return c.json({ success: true, message: 'GitHub resync completed successfully' });
  } catch (error) {
    console.error('[GitHub Resync] Error:', error);

    if (error instanceof Error && error.message.includes('rate limit')) {
      const rateLimitError = error as Error & { resetTime?: string };
      return c.json(
        {
          error: rateLimitError.message,
          rateLimitError: true,
          resetTime: rateLimitError.resetTime,
        },
        429,
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to resync GitHub issues';
    return c.json({ error: errorMessage }, 500);
  }
});

export { usersApp as userRoutes };
