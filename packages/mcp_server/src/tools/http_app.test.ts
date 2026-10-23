import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

import { createMcpHttpApp } from '../http_app.js';
import type { UserSession } from './types.js';

const session: UserSession = {
  userId: 'alice',
  username: 'alice',
  dbName: 'alice',
  attachmentsDbName: 'alice_attachments',
};

function setup(maxRequestBodySize = 1024) {
  const authenticate = vi.fn(async () => session);
  const createServer = vi.fn(() => new McpServer({ name: 'test', version: '1.0.0' }));
  const app = createMcpHttpApp({
    authenticate,
    createServer,
    host: 'localhost',
    maxRequestBodySize,
  });
  return { app, authenticate, createServer };
}

function request(headers: Record<string, string> = {}, body = '{}'): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { Host: 'localhost', 'Content-Type': 'application/json', ...headers },
    body,
  });
}

describe('MCP HTTP security boundary', () => {
  it('rejects missing credentials before lookup', async () => {
    const { app, authenticate } = setup();
    expect((await app.fetch(request())).status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects conflicting credentials', async () => {
    const { app, authenticate } = setup();
    expect(
      (await app.fetch(request({ Authorization: 'Bearer one', 'X-API-Key': 'two' }))).status,
    ).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects oversized credentials before lookup', async () => {
    const { app, authenticate } = setup();
    expect((await app.fetch(request({ Authorization: `Bearer ${'x'.repeat(513)}` }))).status).toBe(
      401,
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects unexpected hosts', async () => {
    const { app, authenticate } = setup();
    expect(
      (await app.fetch(request({ Host: 'evil.example', Authorization: 'Bearer key' }))).status,
    ).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects malformed bearer credentials', async () => {
    const { app } = setup();
    expect((await app.fetch(request({ Authorization: 'Basic secret' }))).status).toBe(401);
  });

  it('bounds request bodies before authentication', async () => {
    const { app, authenticate } = setup(16);
    expect(
      (await app.fetch(request({ Authorization: 'Bearer key' }, JSON.stringify('x'.repeat(32)))))
        .status,
    ).toBe(413);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects unexpected origins', async () => {
    const { app, authenticate } = setup();
    expect(
      (await app.fetch(request({ Origin: 'https://evil.example', Authorization: 'Bearer key' })))
        .status,
    ).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('revalidates credentials on each request', async () => {
    const { app, authenticate } = setup();
    await app.fetch(request({ Authorization: 'Bearer key' }));
    authenticate.mockRejectedValueOnce(new Response(null, { status: 401 }));
    expect((await app.fetch(request({ Authorization: 'Bearer key' }))).status).toBe(401);
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it('does not expose authentication service failures', async () => {
    const { app, authenticate } = setup();
    authenticate.mockRejectedValueOnce(new Error('secret credential'));
    const response = await app.fetch(request({ Authorization: 'Bearer key' }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret credential');
  });

  it('rejects concurrent overload and releases completed admission slots', async () => {
    let release = (): void => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const authenticate = vi.fn(async () => {
      await waiting;
      return session;
    });
    const app = createMcpHttpApp({
      authenticate,
      host: 'localhost',
      maxConcurrentRequests: 1,
      createServer: () => new McpServer({ name: 'test', version: '1.0.0' }),
    });
    const first = app.fetch(request({ Authorization: 'Bearer key' }));
    await vi.waitFor(() => expect(authenticate).toHaveBeenCalledOnce());
    expect((await app.fetch(request({ Authorization: 'Bearer key' }))).status).toBe(503);
    release();
    await first;
    expect((await app.fetch(request({ Authorization: 'Bearer key' }))).status).not.toBe(503);
  });
});
