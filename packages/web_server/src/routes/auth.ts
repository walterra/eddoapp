import { Hono } from 'hono';
import { sign, verify } from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config';

const authApp = new Hono();

// Simple auth schema for demo - in production you'd want proper user management
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Demo login endpoint - in production this would check against a user database
authApp.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = loginSchema.parse(body);

    // Simple demo authentication - replace with real user verification
    const validCredentials =
      (username === 'demo' && password === 'password') ||
      (username === config.couchdb.username &&
        password === config.couchdb.password);

    if (!validCredentials) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT token
    const token = sign(
      {
        username,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      },
      config.jwtSecret,
    );

    return c.json({
      token,
      username,
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
    const decoded = verify(token, config.jwtSecret) as {
      username: string;
      exp: number;
    };
    return c.json({
      valid: true,
      username: decoded.username,
      exp: decoded.exp,
    });
  } catch (_error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export { authApp as authRoutes };
