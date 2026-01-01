import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the config module
vi.mock('../config', () => ({
  config: {
    jwtSecret: 'test-secret-key-at-least-32-characters-long-for-testing',
    couchdb: {
      url: 'http://admin:password@localhost:5984',
      username: 'admin',
      password: 'password',
    },
  },
}));

// Mock core-server to avoid environment validation
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({
    COUCHDB_URL: 'http://admin:password@localhost:5984',
  }),
  createUserRegistry: () => ({
    findByUsername: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByTelegramId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  }),
}));

import { authRoutes } from './auth';

describe('Authentication Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/auth', authRoutes);
  });

  it('should login with valid credentials (short session by default)', async () => {
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
    expect(data).toHaveProperty('expiresIn', '1h');
  });

  it('should login with rememberMe=false for short session', async () => {
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'demo',
        password: 'password',
        rememberMe: false,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('expiresIn', '1h');
  });

  it('should login with rememberMe=true for long session', async () => {
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'demo',
        password: 'password',
        rememberMe: true,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('expiresIn', '30d');
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
