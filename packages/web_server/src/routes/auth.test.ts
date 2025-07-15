import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authRoutes } from './auth';

// Mock the config module
vi.mock('../config', () => ({
  config: {
    jwtSecret: 'test-secret-key-at-least-32-characters-long-for-testing',
    couchdb: {
      username: 'admin',
      password: 'password',
    },
  },
}));

describe('Authentication Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/auth', authRoutes);
  });

  it('should login with valid credentials', async () => {
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'demo',
        password: 'password',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('username', 'demo');
    expect(data).toHaveProperty('expiresIn', '24h');
  });

  it('should reject invalid credentials', async () => {
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'invalid',
        password: 'wrong',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'Invalid credentials');
  });

  it('should reject malformed login request', async () => {
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: '',
        password: '',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'Invalid request');
  });
});
