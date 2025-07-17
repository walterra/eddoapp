import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config';
import {
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from '../utils/crypto';

const usersApp = new Hono();

// Initialize environment and user registry
const env = createEnv();
const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

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

interface JwtTokenPayload {
  userId: string;
  username: string;
  exp: number;
}

// Helper function to extract user from JWT token
async function extractUserFromToken(authHeader: string | undefined) {
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

// Get current user profile
usersApp.get('/profile', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userToken = await extractUserFromToken(authHeader);

  if (!userToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const user = await userRegistry.findByUsername(userToken.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.status !== 'active') {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    // Return safe user profile (without sensitive data)
    return c.json({
      userId: user._id,
      username: user.username,
      email: user.email,
      telegramId: user.telegram_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      permissions: user.permissions,
      status: user.status,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Update user profile
usersApp.put('/profile', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userToken = await extractUserFromToken(authHeader);

  if (!userToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { email, currentPassword, newPassword } =
      updateProfileSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.status !== 'active') {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    const updates: Record<string, unknown> = {};

    // Update email if provided
    if (email && email !== user.email) {
      if (!validateEmail(email)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }

      // Check if email is already in use
      const existingEmail = await userRegistry.findByEmail(email);
      if (existingEmail && existingEmail._id !== user._id) {
        return c.json({ error: 'Email already in use' }, 409);
      }

      updates.email = email;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return c.json(
          { error: 'Current password required to change password' },
          400,
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(
        currentPassword,
        user.password_hash,
      );
      if (!isCurrentPasswordValid) {
        return c.json({ error: 'Current password is incorrect' }, 400);
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return c.json({ error: passwordValidation.errors.join(', ') }, 400);
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);
      updates.password_hash = newPasswordHash;
    }

    // Update timestamp
    updates.updated_at = new Date().toISOString();

    // Apply updates
    const updatedUser = await userRegistry.update(user._id, updates);

    // Return safe updated profile
    return c.json({
      userId: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      telegramId: updatedUser.telegram_id,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      permissions: updatedUser.permissions,
      status: updatedUser.status,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Change password (dedicated endpoint)
usersApp.post('/change-password', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userToken = await extractUserFromToken(authHeader);

  if (!userToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await userRegistry.findByUsername(userToken.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.status !== 'active') {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.password_hash,
    );
    if (!isCurrentPasswordValid) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return c.json({ error: passwordValidation.errors.join(', ') }, 400);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await userRegistry.update(user._id, {
      password_hash: newPasswordHash,
      updated_at: new Date().toISOString(),
    });

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Password change error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// Unlink Telegram account
usersApp.delete('/telegram-link', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userToken = await extractUserFromToken(authHeader);

  if (!userToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const user = await userRegistry.findByUsername(userToken.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.status !== 'active') {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    if (!user.telegram_id) {
      return c.json({ error: 'No Telegram account linked' }, 400);
    }

    // Remove Telegram ID
    await userRegistry.update(user._id, {
      telegram_id: undefined,
      updated_at: new Date().toISOString(),
    });

    return c.json({
      success: true,
      message: 'Telegram account unlinked successfully',
    });
  } catch (error) {
    console.error('Telegram unlink error:', error);
    return c.json({ error: 'Failed to unlink Telegram account' }, 500);
  }
});

export { usersApp as userRoutes };
