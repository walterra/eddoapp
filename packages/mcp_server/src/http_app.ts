import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import type { Hono } from 'hono';

import type { UserSession } from './tools/types.js';

export interface McpHttpOptions {
  authenticate: (request: Request) => Promise<UserSession>;
  createServer: (session: UserSession) => McpServer;
  host: string;
  allowedHosts?: string[];
  maxRequestBodySize?: number;
  maxConcurrentRequests?: number;
}

/** Bounds credential parsing and registry lookup input. */
function validateCredentialLength(credential: string | null | undefined): void {
  if (credential && credential.length > 512) throw new Response(null, { status: 401 });
}

/** Accepts only a single bearer credential in the Authorization header. */
function parseBearer(authorization: string | null): string | undefined {
  if (!authorization) return undefined;
  const bearer = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) throw new Response(null, { status: 401 });
  return bearer;
}

/** Rejects ambiguous credentials before user lookup. */
export function validateCredentialHeaders(request: Request): void {
  const authorization = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const bearer = parseBearer(authorization);
  if (!bearer && !apiKey) throw new Response(null, { status: 401 });
  if (apiKey && bearer && apiKey !== bearer) throw new Response(null, { status: 400 });
  for (const credential of [apiKey, bearer]) {
    validateCredentialLength(credential);
  }
}

/** Builds a bounded, authenticated HTTP boundary without opening a socket. */
export function createMcpHttpApp(options: McpHttpOptions): Hono {
  if (['0.0.0.0', '::'].includes(options.host) && !options.allowedHosts?.length)
    throw new Error('MCP_ALLOWED_HOSTS is required when binding MCP to all interfaces');
  const maxRequestBodySize = options.maxRequestBodySize ?? 8 * 1024 * 1024;
  const app = createMcpHonoApp({
    host: options.host,
    allowedHosts: options.allowedHosts,
    maxRequestBodySize,
  });
  let activeRequests = 0;
  app.all('/mcp', async (c) => {
    if (activeRequests >= (options.maxConcurrentRequests ?? 32))
      return new Response(null, { status: 503, headers: { 'Retry-After': '1' } });
    activeRequests++;
    try {
      validateCredentialHeaders(c.req.raw);
      const session = await options.authenticate(c.req.raw);
      const handler = createMcpHandler(() => options.createServer(session), {
        legacy: 'reject',
        responseMode: 'json',
        maxRequestBodySize,
      });
      try {
        return await handler.fetch(c.req.raw);
      } finally {
        await handler.close();
      }
    } catch (error) {
      if (error instanceof Response) return error;
      return c.json({ error: 'MCP request failed' }, 500);
    } finally {
      activeRequests--;
    }
  });
  return app;
}
