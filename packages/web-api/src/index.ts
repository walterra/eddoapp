import { createEnv, createUserRegistry } from '@eddo/core-server';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import path from 'path';

import { config } from './config';
import { authRoutes } from './routes/auth';
import { dbProxyRoutes } from './routes/db-proxy';
import { userRoutes } from './routes/users';

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
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth routes (no JWT required)
app.route('/auth', authRoutes);

// Protected API routes (JWT required)
app.use('/api/*', jwt({ secret: config.jwtSecret }));
app.route('/api/db', dbProxyRoutes);
app.route('/api/users', userRoutes);

if (!isDevelopment) {
  // Production: Serve static files from public directory
  app.use('/*', serveStatic({ root: publicPath }));

  // SPA fallback - serve index.html for all non-API routes
  app.get('/*', async (c) => {
    // Check if the built index.html exists
    if (existsSync(indexHtmlPath)) {
      const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
      return c.html(indexHtml);
    }

    // Fallback if no index.html exists
    return c.text('Application not built. Run build first.', 404);
  });
} else {
  // Development: Proxy non-API routes to Vite dev server
  app.get('/*', async (c) => {
    const viteDevServerUrl = 'http://localhost:5173';
    const requestPath = c.req.path;

    try {
      const response = await fetch(`${viteDevServerUrl}${requestPath}`);

      // Forward the response from Vite dev server
      const body = await response.text();
      const contentType = response.headers.get('content-type') || 'text/html';

      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
        },
      });
    } catch (error) {
      console.error('Error proxying to Vite dev server:', error);
      return c.text("Vite dev server not available. Make sure it's running on port 5173.", 502);
    }
  });
}

const port = config.port;
console.log(`Server starting on port ${port}`);

// Initialize database
async function initializeDatabase() {
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Ensure user registry database exists
    await userRegistry.ensureDatabase();

    // Setup design documents
    await userRegistry.setupDesignDocuments();

    console.log('✅ User registry database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize user registry database:', error);
    // Don't exit - allow server to start even if database setup fails
  }
}

// Initialize database before starting server
initializeDatabase().then(() => {
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
});

export default app;
