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
console.log('Client build path:', clientBuildPath);

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

// Serve static files (React app) - handle assets first
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
        'Cache-Control': 'public, max-age=31536000', // 1 year cache for assets
      },
    });
  } catch (_error) {
    console.error('Asset not found:', c.req.path);
    return c.text('Asset not found', 404);
  }
});

// Fallback for client-side routing
app.get('/*', async (c) => {
  try {
    const { promises: fs } = await import('fs');
    const indexPath = path.join(clientBuildPath, 'index.html');
    const content = await fs.readFile(indexPath, 'utf-8');
    return c.html(content);
  } catch (error) {
    console.error('Error serving index.html:', error);
    return c.text(
      'Client build not found. Run "pnpm build:client" first.',
      404,
    );
  }
});

const port = config.port;
console.log(`Server starting on port ${port}`);

try {
  serve({
    fetch: app.fetch,
    port,
  });
  console.log(`✅ Server successfully started on port ${port}`);
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}
