import { createEnv, createUserRegistry } from '@eddo/core-server';
import { createDefaultUserPreferences } from '@eddo/core-shared';
// User registry types are implicitly used by the endpoints
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config';
import {
  generateSecureToken,
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../utils/crypto';
import { setupUserDatabase } from '../utils/setup-user-db';

const authApp = new Hono();

// Initialize environment and user registry
const env = createEnv();
const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  telegramId: z.number().optional(),
});

const linkTelegramSchema = z.object({
  linkCode: z.string().min(1),
  telegramId: z.number(),
});

// User registration endpoint
authApp.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, password, telegramId } =
      registerSchema.parse(body);

    // Validate input
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return c.json({ error: usernameValidation.errors.join(', ') }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return c.json({ error: passwordValidation.errors.join(', ') }, 400);
    }

    // Check if user already exists
    const existingUser = await userRegistry.findByUsername(username);
    if (existingUser) {
      return c.json({ error: 'Username already exists' }, 409);
    }

    const existingEmail = await userRegistry.findByEmail(email);
    if (existingEmail) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    if (telegramId) {
      const existingTelegram = await userRegistry.findByTelegramId(telegramId);
      if (existingTelegram) {
        return c.json({ error: 'Telegram ID already registered' }, 409);
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user registry entry
    const user = await userRegistry.create({
      username,
      email,
      password_hash: passwordHash,
      telegram_id: telegramId,
      database_name: '', // Will be set by UserRegistry
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      permissions: ['read', 'write'],
      status: 'active',
      version: 'alpha2',
      preferences: createDefaultUserPreferences(),
    });

    // Create user database with design documents and indexes
    await setupUserDatabase(username);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      },
      config.jwtSecret,
    );

    return c.json({
      token,
      username: user.username,
      userId: user._id,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Updated login endpoint with user registry
authApp.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = loginSchema.parse(body);

    // First try the new user registry
    const user = await userRegistry.findByUsername(username);
    if (user) {
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      if (user.status !== 'active') {
        return c.json({ error: 'Account is suspended' }, 403);
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          username: user.username,
          exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
        },
        config.jwtSecret,
      );

      return c.json({
        token,
        username: user.username,
        userId: user._id,
        expiresIn: '24h',
      });
    }

    // Fallback to demo authentication for backward compatibility
    const url = new URL(config.couchdb.url);
    const validCredentials =
      (username === 'demo' && password === 'password') ||
      (username === url.username && password === url.password);

    if (!validCredentials) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT token for demo user
    const token = jwt.sign(
      {
        userId: `demo_${username}`,
        username,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      },
      config.jwtSecret,
    );

    return c.json({
      token,
      username,
      userId: `demo_${username}`,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// Token validation endpoint
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
  } catch (_error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

interface LinkingCodeData {
  username: string;
  expires: number;
}

interface JwtTokenPayload {
  userId: string;
  username: string;
  exp: number;
}

// In-memory store for linking codes (in production, use Redis or database)
const linkingCodes = new Map<string, LinkingCodeData>();

// Generate linking code for Telegram
authApp.post('/generate-link-code', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;

    // Generate unique linking code
    const linkCode = generateSecureToken();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store the linking code
    linkingCodes.set(linkCode, {
      username: decoded.username,
      expires,
    });

    // Clean up expired codes
    for (const [code, data] of linkingCodes.entries()) {
      if (Date.now() > data.expires) {
        linkingCodes.delete(code);
      }
    }

    return c.json({
      linkCode,
      expiresIn: '5 minutes',
    });
  } catch (_error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Link Telegram account
authApp.post('/link-telegram', async (c) => {
  try {
    const body = await c.req.json();
    const { linkCode, telegramId } = linkTelegramSchema.parse(body);

    // Find linking code
    const linkData = linkingCodes.get(linkCode);
    if (!linkData) {
      return c.json({ error: 'Invalid or expired link code' }, 400);
    }

    // Check if code is expired
    if (Date.now() > linkData.expires) {
      linkingCodes.delete(linkCode);
      return c.json({ error: 'Link code expired' }, 400);
    }

    // Check if Telegram ID is already linked
    const existingTelegram = await userRegistry.findByTelegramId(telegramId);
    if (existingTelegram) {
      return c.json(
        { error: 'Telegram ID already linked to another account' },
        409,
      );
    }

    // Find user and update with Telegram ID
    const user = await userRegistry.findByUsername(linkData.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update user with Telegram ID
    await userRegistry.update(user._id, {
      telegram_id: telegramId,
    });

    // Clean up the linking code
    linkingCodes.delete(linkCode);

    return c.json({
      success: true,
      username: linkData.username,
    });
  } catch (error) {
    console.error('Telegram linking error:', error);
    return c.json({ error: 'Linking failed' }, 500);
  }
});

export { authApp as authRoutes };
