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
  /** Comma-separated list of entity IDs to filter by */
  entityIds: z.string().optional(),
});

/** Schema for creating audit log entries */
const createAuditEntrySchema = z.object({
  action: z.enum([
    'create',
    'update',
    'delete',
    'complete',
    'uncomplete',
    'time_tracking_start',
    'time_tracking_stop',
  ]),
  entityId: z.string(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
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

      // Parse entityIds from comma-separated string
      const entityIds = query.entityIds ? query.entityIds.split(',').filter(Boolean) : undefined;
      if (entityIds) {
        span.setAttribute('audit.entity_ids_count', entityIds.length);
      }

      const auditService = createAuditService(env.COUCHDB_URL, env, username);
      const result = await auditService.getEntries({
        limit: query.limit,
        startAfter: query.startAfter,
        entityIds,
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
 * POST /api/audit-log
 * Create a new audit log entry (called by web client after mutations)
 */
auditLogApp.post('/', async (c) => {
  return withSpan('audit_log_create', { 'audit.operation': 'create' }, async (span) => {
    const payload = c.get('jwtPayload') as jwt.JwtPayload;
    const username = payload.username;

    span.setAttribute('user.name', username);

    try {
      const body = await c.req.json();
      const data = createAuditEntrySchema.parse(body);

      span.setAttribute('audit.action', data.action);
      span.setAttribute('audit.entity_id', data.entityId);

      // Ensure audit database exists
      await ensureAuditDatabase(env.COUCHDB_URL, env, username);

      const auditService = createAuditService(env.COUCHDB_URL, env, username);
      const entry = await auditService.logAction({
        action: data.action,
        entityId: data.entityId,
        source: 'web',
        before: data.before as Record<string, unknown> | undefined,
        after: data.after as Record<string, unknown> | undefined,
        metadata: data.metadata,
      });

      span.setAttribute('audit.entry_id', entry._id);

      return c.json({ success: true, entry });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid request body', details: error.errors }, 400);
      }

      logger.error({ error, username }, 'Failed to create audit log entry');
      return c.json({ error: 'Failed to create audit log entry' }, 500);
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

/** Send SSE connected message */
async function sendConnectedMessage(stream: SSEStream, username: string): Promise<void> {
  await stream.writeSSE({
    event: 'connected',
    data: JSON.stringify({ status: 'connected', username }),
    id: '0',
  });
}

/** Send SSE heartbeat message */
async function sendHeartbeat(stream: SSEStream): Promise<void> {
  await stream.writeSSE({
    event: 'heartbeat',
    data: JSON.stringify({ timestamp: new Date().toISOString() }),
  });
}

/** Setup changes listener and heartbeat loop */
async function runStreamLoop(
  stream: SSEStream,
  auditDb: DocumentScope<AuditLogAlpha1>,
  isConnectedRef: { value: boolean },
): Promise<void> {
  const changesEmitter = auditDb.changesReader.start({ includeDocs: true, since: 'now' });

  changesEmitter.on('change', async (change: { id: string; seq: number; doc?: AuditLogAlpha1 }) => {
    if (!change.doc || change.id.startsWith('_design/')) return;
    await stream.writeSSE({
      event: 'audit-entry',
      data: JSON.stringify(change.doc),
      id: String(change.seq),
    });
  });

  changesEmitter.on('error', (err: Error) => {
    logger.error({ error: err }, 'Audit log SSE changes feed error');
  });

  while (isConnectedRef.value) {
    await stream.sleep(30000);
    if (isConnectedRef.value) await sendHeartbeat(stream);
  }
}

/** Handle SSE stream for audit log updates */
async function handleAuditLogStream(stream: SSEStream, username: string): Promise<void> {
  const isConnectedRef = { value: true };
  let auditDb: DocumentScope<AuditLogAlpha1> | null = null;

  stream.onAbort(() => {
    logger.debug({ username }, 'Audit log SSE client disconnected');
    isConnectedRef.value = false;
    if (auditDb) auditDb.changesReader.stop();
  });

  try {
    await ensureAuditDatabase(env.COUCHDB_URL, env, username);
    const dbName = getAuditDatabaseName(env, username);
    auditDb = couchConnection.db.use<AuditLogAlpha1>(dbName);

    await sendConnectedMessage(stream, username);
    await runStreamLoop(stream, auditDb, isConnectedRef);
  } catch (error) {
    logger.error({ error, username }, 'Audit log SSE stream error');
    if (auditDb) auditDb.changesReader.stop();
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
