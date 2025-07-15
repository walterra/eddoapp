import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/serve-static';

import { config } from './config';
import { authRoutes } from './routes/auth';
import { dbProxyRoutes } from './routes/db-proxy';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: config.corsOrigin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// Auth routes (no JWT required)
app.route('/auth', authRoutes);

// Protected API routes (JWT required)
app.use('/api/*', jwt({ secret: config.jwtSecret }));
app.route('/api/db', dbProxyRoutes);

// Serve static files (React app)
app.use(
  '/*',
  serveStatic({
    root: './dist/client',
    getContent: async (path, _c) => {
      try {
        const { promises: fs } = await import('fs');
        const filePath = `./dist/client${path}`;
        const content = await fs.readFile(filePath);
        return new Response(content);
      } catch {
        return null;
      }
    },
  }),
);

// Fallback for client-side routing
app.get('/*', async (c) => {
  try {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile('./dist/client/index.html', 'utf-8');
    return c.html(content);
  } catch {
    return c.text('Not Found', 404);
  }
});

const port = config.port;
console.log(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
