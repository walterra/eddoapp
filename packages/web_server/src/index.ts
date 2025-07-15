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
const isDevelopment = config.nodeEnv === 'development';

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

// Protected API routes (JWT required)
app.use('/api/*', jwt({ secret: config.jwtSecret }));
app.route('/api/db', dbProxyRoutes);

// In development, proxy to the separate client dev server
// In production, serve the built client files
if (isDevelopment) {
  // Development: proxy to the separate web_client dev server
  app.get('/*', async (c) => {
    // Let API routes pass through
    if (
      c.req.path.startsWith('/api/') ||
      c.req.path.startsWith('/auth/') ||
      c.req.path === '/health'
    ) {
      return c.text('Not Found', 404);
    }

    try {
      const clientUrl = 'http://localhost:5173';
      const response = await fetch(`${clientUrl}${c.req.path}`, {
        method: c.req.method,
        headers: Object.fromEntries(c.req.headers.entries()),
      });

      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('Error proxying to client dev server:', error);
      return c.text(
        'Client dev server not available. Run "pnpm dev:web-client" first.',
        503,
      );
    }
  });
} else {
  // Production: serve built client files
  app.get('/assets/*', async (c) => {
    try {
      const { promises: fs } = await import('fs');
      const assetPath = c.req.path;
      const filePath = path.join(clientBuildPath, assetPath);
      const content = await fs.readFile(filePath);

      // Set proper MIME type based on file extension
      const ext = path.extname(assetPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      return new Response(content, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    } catch (_error) {
      console.error('Asset not found:', c.req.path);
      return c.text('Asset not found', 404);
    }
  });

  // Production: fallback for client-side routing
  app.get('/*', async (c) => {
    try {
      const { promises: fs } = await import('fs');
      const indexPath = path.join(clientBuildPath, 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');
      return c.html(content);
    } catch (error) {
      console.error('Error serving index.html:', error);
      return c.text(
        'Client build not found. Run "pnpm build:web-client" first.',
        404,
      );
    }
  });
}

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
