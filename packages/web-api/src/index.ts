// Note: OTEL auto-instrumentation is loaded via --import flag in package.json dev script
// See: node --import @elastic/opentelemetry-node --import tsx src/index.ts

// Configure global HTTP timeout (2 minutes for slow operations)
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ bodyTimeout: 120_000, headersTimeout: 120_000 }));

import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { TodoAlpha3 } from '@eddo/core-shared';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger as honoLogger } from 'hono/logger';
import nano from 'nano';
import path from 'path';

import { createChatRoutes, createChatService } from './chat';
import { config } from './config';
import {
  createElasticsearchClientFromEnv,
  createSyncService,
  type SyncService,
} from './elasticsearch';
import { createEmailSyncScheduler } from './email/sync-scheduler';
import { createGithubSyncScheduler } from './github/sync-scheduler';
import { attachmentsDbProxyRoutes } from './routes/attachments-db-proxy';
import { auditLogRoutes } from './routes/audit-log';
import { authRoutes } from './routes/auth';
import { dbProxyRoutes } from './routes/db-proxy';
import { emailRoutes } from './routes/email';
import { rssRoutes } from './routes/rss';
import { searchRoutes } from './routes/search';
import { telemetryRoutes } from './routes/telemetry';
import { userRoutes } from './routes/users';
import { createRssSyncScheduler } from './rss/sync-scheduler';
import { logger } from './utils/logger';

const app = new Hono();

// Get absolute path to public directory (where web-client builds to)
const publicPath = path.resolve(process.cwd(), 'public');
const indexHtmlPath = path.join(publicPath, 'index.html');
const isDevelopment = process.env.NODE_ENV === 'development';

logger.info({ isDevelopment, publicPath, indexHtmlPath }, 'Server configuration');

// Middleware - use Hono's built-in logger for request logging
app.use('*', honoLogger());
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

// Email OAuth callback (no JWT required - Google redirects here)
app.route('/api/email', emailRoutes);

// Telemetry proxy (no JWT required - browser sends traces before auth)
app.route('/api/telemetry', telemetryRoutes);

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
  const jwtMiddleware = jwt({ secret: config.jwtSecret, alg: 'HS256' });
  return jwtMiddleware(c, next);
});
app.route('/api/db', dbProxyRoutes);
app.route('/api/attachments-db', attachmentsDbProxyRoutes);
app.route('/api/users', userRoutes);
app.route('/api/rss', rssRoutes);
app.route('/api/audit-log', auditLogRoutes);
app.route('/api/search', searchRoutes);

// Chat service and routes
const env = createEnv();
const chatService = createChatService({ env, couchUrl: env.COUCHDB_URL });
const chatRoutes = createChatRoutes(chatService);
app.route('/api/chat', chatRoutes);

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
      logger.error({ error }, 'Error proxying to Vite dev server');
      return c.text("Vite dev server not available. Make sure it's running on port 5173.", 502);
    }
  });
}

const port = config.port;
logger.info({ port }, 'Server starting');

// GitHub sync scheduler instance (initialized after database setup)
let githubSchedulerInstance: ReturnType<typeof createGithubSyncScheduler> | null = null;

// RSS sync scheduler instance (initialized after database setup)
let rssSchedulerInstance: ReturnType<typeof createRssSyncScheduler> | null = null;

// Email sync scheduler instance (initialized after database setup)
let emailSchedulerInstance: ReturnType<typeof createEmailSyncScheduler> | null = null;

// Elasticsearch sync service instance
let esSyncServiceInstance: SyncService | null = null;

// Export getter for scheduler instance
export function getGithubScheduler() {
  if (!githubSchedulerInstance) {
    throw new Error('GitHub scheduler not initialized yet');
  }
  return githubSchedulerInstance;
}

// Export getter for RSS scheduler instance
export function getRssScheduler() {
  if (!rssSchedulerInstance) {
    throw new Error('RSS scheduler not initialized yet');
  }
  return rssSchedulerInstance;
}

// Export getter for Email scheduler instance
export function getEmailScheduler() {
  if (!emailSchedulerInstance) {
    throw new Error('Email scheduler not initialized yet');
  }
  return emailSchedulerInstance;
}

// Export getter for Elasticsearch sync service instance
export function getEsSyncService() {
  if (!esSyncServiceInstance) {
    throw new Error('Elasticsearch sync service not initialized yet');
  }
  return esSyncServiceInstance;
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

    logger.info('User registry database initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize user registry database');
    // Don't exit - allow server to start even if database setup fails
  }
}

/** Creates a sync logger adapter for pino */
function createSyncLoggerAdapter(childLogger: typeof logger) {
  return {
    info: (msg: string, meta?: unknown) => childLogger.info(meta ?? {}, msg),
    warn: (msg: string, meta?: unknown) => childLogger.warn(meta ?? {}, msg),
    error: (msg: string, meta?: unknown) => childLogger.error(meta ?? {}, msg),
    debug: (msg: string, meta?: unknown) => childLogger.debug(meta ?? {}, msg),
  };
}

/** Initialize Elasticsearch sync service */
async function initializeElasticsearchSync(couch: ReturnType<typeof nano>) {
  // Check if Elasticsearch URL is configured
  const esUrl = process.env.ELASTICSEARCH_URL;
  if (!esUrl) {
    logger.warn('ELASTICSEARCH_URL not configured, skipping Elasticsearch sync');
    return;
  }

  try {
    const esClient = createElasticsearchClientFromEnv();

    esSyncServiceInstance = createSyncService({
      esClient,
      getCouchDb: () => couch,
      logger: logger.child({ component: 'es-sync' }),
    });

    await esSyncServiceInstance.initialize();
    logger.info('Elasticsearch sync service started');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Elasticsearch sync service');
    // Don't fail startup - ES sync is optional
  }
}

/** Initialize sync schedulers */
function initializeSyncSchedulers(couch: ReturnType<typeof nano>) {
  const getUserDb = (dbName: string) => couch.db.use<TodoAlpha3>(dbName);
  const checkIntervalMs = 1 * 60 * 1000; // Check every 1 minute

  githubSchedulerInstance = createGithubSyncScheduler({
    checkIntervalMs,
    logger: createSyncLoggerAdapter(logger.child({ component: 'github-sync' })),
    getUserDb,
  });
  githubSchedulerInstance.start();
  logger.info('GitHub sync scheduler started');

  rssSchedulerInstance = createRssSyncScheduler({
    checkIntervalMs,
    logger: createSyncLoggerAdapter(logger.child({ component: 'rss-sync' })),
    getUserDb,
  });
  rssSchedulerInstance.start();
  logger.info('RSS sync scheduler started');

  emailSchedulerInstance = createEmailSyncScheduler({
    checkIntervalMs,
    logger: createSyncLoggerAdapter(logger.child({ component: 'email-sync' })),
    getUserDb,
  });
  emailSchedulerInstance.start();
  logger.info('Email sync scheduler started');
}

// Initialize database before starting server
initializeDatabase().then(async () => {
  const env = createEnv();
  const couch = nano(env.COUCHDB_URL);

  initializeSyncSchedulers(couch);

  // Initialize Elasticsearch sync (async, non-blocking)
  await initializeElasticsearchSync(couch);

  // Start server with graceful shutdown
  const server = serve({
    fetch: app.fetch,
    port,
  });

  logger.info({ port }, 'Server successfully started');

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully');

    // Stop GitHub sync scheduler
    if (githubSchedulerInstance) {
      githubSchedulerInstance.stop();
      logger.info('GitHub sync scheduler stopped');
    }

    // Stop RSS sync scheduler
    if (rssSchedulerInstance) {
      rssSchedulerInstance.stop();
      logger.info('RSS sync scheduler stopped');
    }

    // Stop Email sync scheduler
    if (emailSchedulerInstance) {
      emailSchedulerInstance.stop();
      logger.info('Email sync scheduler stopped');
    }

    // Stop Elasticsearch sync service
    if (esSyncServiceInstance) {
      esSyncServiceInstance.shutdown();
      logger.info('Elasticsearch sync service stopped');
    }

    // Close the server
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Force shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Listen for shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
});

export default app;
