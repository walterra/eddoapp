import { serve } from '@hono/node-server';
import { existsSync, readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/node-server';
import path from 'path';

import { config } from './config';
import { authRoutes } from './routes/auth';
import { dbProxyRoutes } from './routes/db-proxy';

const app = new Hono();

// Get absolute path to public directory (where web-client builds to)
const publicPath = path.resolve(process.cwd(), 'public');
const indexHtmlPath = path.join(publicPath, 'index.html');
const isDevelopment = process.env.NODE_ENV === 'development';

console.log('Development mode:', isDevelopment);
console.log('Public path:', publicPath);
console.log('Index.html path:', indexHtmlPath);

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

// Static file serving from public directory (production builds)
app.use('/*', serveStatic({ root: publicPath }));

// SPA fallback - serve index.html for all non-API routes
app.get('/*', async (c) => {
  // Don't serve SPA fallback for API routes - they should already be handled above
  if (
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/auth/') ||
    c.req.path === '/health'
  ) {
    return c.text('Not Found', 404);
  }

  // In development mode, serve a simple fallback
  if (isDevelopment) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
          <meta name="theme-color" content="#fff" />
          <title>Eddo</title>
          <script>
            window.process = { env: { NODE_DEBUG: undefined } }; // https://github.com/pouchdb/pouchdb/issues/8266
            window.global = window;
          </script>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="/src/client.tsx"></script>
        </body>
      </html>
    `);
  }

  // In production, serve the built index.html
  if (existsSync(indexHtmlPath)) {
    const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
    return c.html(indexHtml);
  }

  // Fallback if no index.html exists
  return c.text('Application not built. Run build first.', 404);
});

const port = config.port;
console.log(`Server starting on port ${port}`);

// Start server with graceful shutdown
const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Server successfully started on port ${port}`);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  // Close the server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Force shutdown');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
