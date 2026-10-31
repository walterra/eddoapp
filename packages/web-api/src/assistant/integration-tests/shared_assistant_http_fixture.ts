import type { Env } from '@eddo/core-server';
import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';
import { assistantHttpBoundary } from '../assistant_access';
import { createAssistantHostClient } from '../assistant_host_client';
import { createAssistantRoutes } from '../assistant_routes';
import { createAssistantService } from '../assistant_service';

interface HttpFixtureOptions {
  env: Env;
  username: string;
  token: string;
  fetch: typeof fetch;
}
const secret = 'shared-assistant-fixture-jwt-secret-at-least-32-characters';

/** Exercises JWT routes and serialized host transport without starting a network listener. */
export async function sharedAssistantHttpFixture(options: HttpFixtureOptions) {
  const { username, env, token } = options;
  const host = createAssistantHostClient({ port: 3003, token, fetch: options.fetch });
  const service = { ...createAssistantService(env, { ASSISTANT_INTERNAL_TOKEN: token }), host };
  const app = new Hono();
  app.use('/api/assistant/*', assistantHttpBoundary());
  app.use('/api/assistant/*', jwt({ secret, alg: 'HS256' }));
  app.route('/api/assistant', createAssistantRoutes(service));
  const jwtToken = await sign(
    { username, exp: Math.floor(Date.now() / 1000) + 3600 },
    secret,
    'HS256',
  );
  return {
    app,
    service,
    headers: { Authorization: `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
  };
}
