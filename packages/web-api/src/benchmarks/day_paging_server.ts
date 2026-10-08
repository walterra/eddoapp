import { createEnv, createUserRegistry } from '@eddo/core-server';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { readFileSync } from 'node:fs';

import { config } from '../config';
import { attachmentsDbProxyRoutes } from '../routes/attachments-db-proxy';
import { authRoutes } from '../routes/auth';
import { dbProxyRoutes } from '../routes/db-proxy';
import { createTelemetryRoutes } from '../routes/telemetry';
import { createSafeProfile } from '../routes/users-helpers';

const env = createEnv();
const registry = createUserRegistry(env.COUCHDB_URL, env);
const app = new Hono();

app.get('/health', (context) => context.json({ status: 'ok' }));
app.get('/benchmark/bootstrap.js', (context) => {
  context.header('Content-Type', 'application/javascript');
  return context.body(readFileSync('benchmark-results/bootstrap/bootstrap.js', 'utf8'));
});
app.get('/benchmark/bootstrap', (context) =>
  context.html(`<!doctype html><html lang="en"><meta charset="utf-8">
<title>Eddo benchmark preparation</title><style>body{font:18px system-ui;margin:48px}pre{line-height:1.6}</style>
<h1>Preparing disposable browser database</h1><p>The measured application has not mounted. Normal live-sync settings remain unchanged during paging.</p>
<pre id="progress">Starting…</pre><script src="/benchmark/bootstrap.js"></script></html>`),
);
app.route('/auth', authRoutes);
if (process.env.EDDO_BENCHMARK_TELEMETRY === 'true') {
  app.use('/api/telemetry/*', jwt({ secret: config.jwtSecret, alg: 'HS256' }));
  app.route(
    '/api/telemetry',
    createTelemetryRoutes({
      getConfig: createEnv,
      fetch: globalThis.fetch,
      allowDefaultEndpoint: true,
    }),
  );
} else app.post('/api/telemetry/*', (context) => context.body(null, 204));
app.use('/api/*', jwt({ secret: config.jwtSecret, alg: 'HS256' }));
app.route('/api/db', dbProxyRoutes);
app.route('/api/attachments-db', attachmentsDbProxyRoutes);
app.get('/api/users/profile', async (context) => {
  const user = await registry.findByUsername('benchmark');
  return user
    ? context.json(createSafeProfile(user))
    : context.json({ error: 'Missing user' }, 404);
});
app.put('/api/users/preferences', async (context) => {
  const user = await registry.findByUsername('benchmark');
  if (!user) return context.json({ error: 'Missing user' }, 404);
  const preferences = await context.req.json<Record<string, unknown>>();
  await registry.update(user._id, { preferences: { ...user.preferences, ...preferences } });
  return context.json({ success: true });
});
app.all('/api/*', (context) => context.json({ error: 'Outside paging benchmark scope' }, 404));
app.use('/*', serveStatic({ root: 'packages/web-api/public' }));
app.get('/*', (context) =>
  context.html(readFileSync('packages/web-api/public/index.html', 'utf8')),
);

const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: config.port });
process.on('SIGTERM', () =>
  server.close(() => {
    // The preloaded SDK owns shutdown and flushing when telemetry is enabled.
    if (process.env.EDDO_BENCHMARK_TELEMETRY !== 'true') process.exit(0);
  }),
);
