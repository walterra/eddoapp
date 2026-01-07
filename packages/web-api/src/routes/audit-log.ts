/**
 * Audit log API routes for streaming and fetching audit entries.
 */
import {
  createAuditService,
  createEnv,
  ensureAuditDatabase,
  getAuditDatabaseName,
  type AuditLogAlpha1,
} from '@eddo/core-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import jwt from 'jsonwebtoken';
import nano, { type DocumentScope } from 'nano';
import { z } from 'zod';

import { logger, withSpan } from '../utils/logger';
import { type SSEStream } from './users-sse';

const auditLogApp = new Hono();

// Initialize environment
const env = createEnv();
const couchConnection = nano(env.COUCHDB_URL);

/** Query schema for listing audit entries */
const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  startAfter: z.string().optional(),
});

/**
 * GET /api/audit-log
 * Fetch audit log entries with pagination (newest first)
 */
auditLogApp.get('/', async (c) => {
  return withSpan('audit_log_list', { 'audit.operation': 'list' }, async (span) => {
    const payload = c.get('jwtPayload') as jwt.JwtPayload;
    const username = payload.username;

    span.setAttribute('user.name', username);

    try {
      const query = listQuerySchema.parse(c.req.query());
      span.setAttribute('audit.limit', query.limit);

      const auditService = createAuditService(env.COUCHDB_URL, env, username);
      const result = await auditService.getEntries({
        limit: query.limit,
        startAfter: query.startAfter,
      });

      span.setAttribute('audit.entries_count', result.entries.length);
      span.setAttribute('audit.has_more', result.hasMore);

      return c.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid query parameters' }, 400);
      }

      // Handle missing database (user hasn't had any audit activity yet)
      if (isNotFoundError(error)) {
        return c.json({ entries: [], hasMore: false });
      }

      logger.error({ error, username }, 'Failed to fetch audit log');
      return c.json({ error: 'Failed to fetch audit log' }, 500);
    }
  });
});

/**
 * GET /api/audit-log/stream
 * SSE endpoint for real-time audit log updates
 */
auditLogApp.get('/stream', async (c) => {
  const payload = c.get('jwtPayload') as jwt.JwtPayload;
  const username = payload.username;

  logger.debug({ username }, 'Starting SSE audit log stream');

  return streamSSE(c, async (stream) => {
    await handleAuditLogStream(stream, username);
  });
});

/**
 * Handle SSE stream for audit log updates
 */
async function handleAuditLogStream(stream: SSEStream, username: string): Promise<void> {
  let isConnected = true;
  let auditDb: DocumentScope<AuditLogAlpha1> | null = null;

  stream.onAbort(() => {
    logger.debug({ username }, 'Audit log SSE client disconnected');
    isConnected = false;
    if (auditDb) {
      auditDb.changesReader.stop();
    }
  });

  try {
    // Ensure the audit database exists
    await ensureAuditDatabase(env.COUCHDB_URL, env, username);

    const dbName = getAuditDatabaseName(env, username);
    auditDb = couchConnection.db.use<AuditLogAlpha1>(dbName);

    // Send connected message
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ status: 'connected', username }),
      id: '0',
    });

    // Start watching for changes
    const changesEmitter = auditDb.changesReader.start({
      includeDocs: true,
      since: 'now',
    });

    changesEmitter.on(
      'change',
      async (change: { id: string; seq: number; doc?: AuditLogAlpha1 }) => {
        if (!change.doc || change.id.startsWith('_design/')) return;

        await stream.writeSSE({
          event: 'audit-entry',
          data: JSON.stringify(change.doc),
          id: String(change.seq),
        });
      },
    );

    changesEmitter.on('error', (err: Error) => {
      logger.error({ error: err, username }, 'Audit log SSE changes feed error');
    });

    // Keep connection alive with heartbeats
    while (isConnected) {
      await stream.sleep(30000);
      if (isConnected) {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
      }
    }
  } catch (error) {
    logger.error({ error, username }, 'Audit log SSE stream error');
    if (auditDb) {
      auditDb.changesReader.stop();
    }
  }
}

/**
 * Check if error is a 404 not found
 */
function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

export { auditLogApp as auditLogRoutes };
