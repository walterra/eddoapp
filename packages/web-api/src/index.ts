import { createEnv, createUserRegistry } from '@eddo/core-server';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import nano from 'nano';
import path from 'path';

import { config } from './config';
import { createGithubSyncScheduler } from './github/sync-scheduler';
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
// Custom middleware that supports both header and query param tokens (for SSE/EventSource)
app.use('/api/*', async (c, next) => {
  // Check for token in query param (needed for EventSource which doesn't support headers)
  const tokenParam = c.req.query('token');
  if (tokenParam && !c.req.header('Authorization')) {
    // Add the token as Authorization header so jwt() middleware can process it
    c.req.raw.headers.set('Authorization', `Bearer ${tokenParam}`);
  }
  // Apply standard JWT middleware
  const jwtMiddleware = jwt({ secret: config.jwtSecret });
  return jwtMiddleware(c, next);
});
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

// GitHub sync scheduler instance (initialized after database setup)
let githubSchedulerInstance: ReturnType<typeof createGithubSyncScheduler> | null = null;

// Export getter for scheduler instance
export function getGithubScheduler() {
  if (!githubSchedulerInstance) {
    throw new Error('GitHub scheduler not initialized yet');
  }
  return githubSchedulerInstance;
}

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
  // Initialize GitHub sync scheduler
  const env = createEnv();
  const couch = nano(env.COUCHDB_URL);

  githubSchedulerInstance = createGithubSyncScheduler({
    checkIntervalMs: 1 * 60 * 1000, // Check every 1 minute (matches smallest user interval)
    logger: {
      info: (msg, meta) => console.log('[GitHub Sync]', msg, meta || ''),
      warn: (msg, meta) => console.warn('[GitHub Sync]', msg, meta || ''),
      error: (msg, meta) => console.error('[GitHub Sync]', msg, meta || ''),
      debug: (msg, meta) => console.debug('[GitHub Sync]', msg, meta || ''),
    },
    getUserDb: (dbName: string) => couch.db.use(dbName),
  });

  // Start GitHub sync scheduler
  githubSchedulerInstance.start();
  console.log('✅ GitHub sync scheduler started');

  // Start server with graceful shutdown
  const server = serve({
    fetch: app.fetch,
    port,
  });

  console.log(`✅ Server successfully started on port ${port}`);

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

    // Stop GitHub sync scheduler
    if (githubSchedulerInstance) {
      githubSchedulerInstance.stop();
      console.log('✅ GitHub sync scheduler stopped');
    }

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
