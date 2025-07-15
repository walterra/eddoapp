import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import path from 'path';

import { config } from './config';
import { authRoutes } from './routes/auth';
import { dbProxyRoutes } from './routes/db-proxy';

const app = new Hono();

// Get absolute path to client build directory
const clientBuildPath = path.resolve(process.cwd(), '../../dist/client');
const isDevelopment = import.meta.env.DEV;

console.log('Development mode:', isDevelopment);
if (!isDevelopment) {
  console.log('Client build path:', clientBuildPath);
}

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

// Static file serving will be handled by Vite dev server in development
// No manual static file serving needed when using @hono/vite-dev-server

// Protected API routes (JWT required)
app.use('/api/*', jwt({ secret: config.jwtSecret }));
app.route('/api/db', dbProxyRoutes);

// Serve client application (unified approach)
app.get('/*', async (c) => {
  // Don't serve client for API routes - they should already be handled above
  if (
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/auth/') ||
    c.req.path === '/health'
  ) {
    return c.text('Not Found', 404);
  }

  // Serve the React app
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
        ${
          import.meta.env.DEV
            ? `<script type="module" src="/@vite/client"></script>`
            : ''
        }
      </head>
      <body>
        <div id="root"></div>
        ${
          import.meta.env.DEV
            ? `<script type="module" src="/src/client.tsx"></script>`
            : `<script type="module" src="/static/client.js"></script>`
        }
      </body>
    </html>
  `);
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
