import { Hono } from 'hono';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { handleCreateSession } from './chat-route-handlers';
import type { ChatService } from './chat-service';

interface TestSpan {
  setAttribute: (name: string, value: unknown) => void;
}
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  withSpan: async (
    _name: string,
    _attributes: unknown,
    callback: (span: TestSpan) => Promise<unknown>,
  ) => callback({ setAttribute: vi.fn() }),
}));
interface TestVariables {
  jwtPayload: unknown;
}
interface TestEnv {
  Variables: TestVariables;
}
interface HttpFixture {
  app: Hono<TestEnv>;
  createSession: Mock<ChatService['createSession']>;
}

function fixture(): HttpFixture {
  const createSession = vi.fn<ChatService['createSession']>();
  const service = { createSession } as unknown as ChatService;
  const app = new Hono<TestEnv>();
  app.use('*', async (context, next) => {
    context.set('jwtPayload', { username: 'user' });
    await next();
  });
  app.post('/sessions', (context) => handleCreateSession(context, service));
  return { app, createSession };
}

describe('chat validation HTTP contracts', () => {
  it('returns the existing 400 envelope and array paths before invoking the service', async () => {
    const test = fixture();
    const response = await test.app.request('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repository: { slug: 'repo', gitUrl: 'private-invalid-url' } }),
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Invalid request',
      details: [{ code: 'invalid_format', path: ['repository', 'gitUrl'] }],
    });
    expect(JSON.stringify(body)).not.toContain('private-invalid-url');
    expect(test.createSession).not.toHaveBeenCalled();
  });

  it('keeps infrastructure errors distinct from validation failures', async () => {
    const test = fixture();
    test.createSession.mockRejectedValue(new Error('private-database-secret'));
    const response = await test.app.request('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to create session' });
  });
});
