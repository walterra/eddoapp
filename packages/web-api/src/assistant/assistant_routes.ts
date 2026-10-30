import type { AssistantMessageSubmission } from '@eddo/core-shared';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { assistantAccess, type AssistantRouteEnv } from './assistant_access';
import { readChangeCursor } from './assistant_cursors';
import { AssistantApiError } from './assistant_errors';
import { createAssistantLimits, type AssistantLimits } from './assistant_limits';
import { runAssistantStream } from './assistant_stream';
import type { AssistantService } from './assistant_types';
import { boundedJson } from './bounded_json';

const historySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(30),
    cursor: z.string().max(4096).optional(),
  })
  .strict();
const submissionSchema = z
  .object({ requestId: z.uuid(), text: z.string().trim().min(1).max(8000) })
  .strict();
const streamSchema = z
  .object({ cursor: z.string().max(4096).optional(), requestIds: z.string().max(3000).optional() })
  .strict();

function requestId(username: string, value: string): string {
  const prefix = `web:${username}:`;
  if (!value.startsWith(prefix) || !z.uuid().safeParse(value.slice(prefix.length)).success)
    throw new AssistantApiError(403, 'forbidden');
  return value;
}

function failure(context: Context<AssistantRouteEnv>, error: unknown): Response {
  const result =
    error instanceof AssistantApiError ? error : new AssistantApiError(503, 'unavailable');
  if (result.status === 429) context.header('Retry-After', '60');
  return context.json({ error: result.code }, result.status);
}

async function submission(
  context: Context<AssistantRouteEnv>,
): Promise<AssistantMessageSubmission> {
  try {
    if (
      context.req.header('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      throw new Error('JSON required');
    return submissionSchema.parse(await boundedJson(context.req.raw, 32768, 413));
  } catch (error) {
    if (error instanceof AssistantApiError && error.status === 413) throw error;
    throw new AssistantApiError(400, 'invalid_request');
  }
}

function stream(
  context: Context<AssistantRouteEnv>,
  service: AssistantService,
  limits: AssistantLimits,
): Response {
  const parsed = streamSchema.safeParse(context.req.query());
  if (!parsed.success) throw new AssistantApiError(400, 'invalid_request');
  const identity = context.get('assistantIdentity');
  const ids = parsed.data.requestIds?.split(',') ?? [];
  if (ids.length > 10) throw new AssistantApiError(400, 'invalid_request');
  const requestIds = [...new Set(ids.map((id) => requestId(identity.username, id)))];
  const header = context.req.header('Last-Event-ID');
  if (header && parsed.data.cursor && header !== parsed.data.cursor)
    throw new AssistantApiError(400, 'invalid_request');
  const cursor = header ?? parsed.data.cursor;
  const since = cursor === undefined ? undefined : readChangeCursor(identity.username, cursor);
  const release = limits.acquireStream(identity.username);
  const response = streamSSE(context, async (sink) => {
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    sink.onAbort(abort);
    context.req.raw.signal.addEventListener('abort', abort, { once: true });
    if (context.req.raw.signal.aborted) abort();
    const timer = setTimeout(
      abort,
      Math.max(0, Math.min(identity.expiresAt - Date.now(), 300_000)),
    );
    try {
      await runAssistantStream(
        service,
        identity,
        { since, requestIds, signal: controller.signal },
        {
          send: (event, data, id) =>
            sink.writeSSE({ event, data: JSON.stringify(data), ...(id ? { id } : {}) }),
        },
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
      release();
      context.req.raw.signal.removeEventListener('abort', abort);
    }
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** Exposes authenticated projection reads and forwards submissions without opening execution journals. */
export function createAssistantRoutes(
  service: AssistantService,
  limits: AssistantLimits = createAssistantLimits(),
): Hono<AssistantRouteEnv> {
  const app = new Hono<AssistantRouteEnv>();
  app.onError((error, context) => failure(context, error));
  app.use('*', assistantAccess(service, limits));
  app.get('/conversation', async (context) => {
    const query = historySchema.safeParse(context.req.query());
    if (!query.success) throw new AssistantApiError(400, 'invalid_request');
    return context.json(
      await service.store.history(context.get('assistantIdentity').username, query.data),
    );
  });
  app.post('/messages', async (context) => {
    return context.json(
      await service.host.admit(
        context.get('assistantIdentity').username,
        await submission(context),
      ),
      202,
    );
  });
  app.get('/requests', async (context) =>
    context.json(
      await service.host.pending(context.get('assistantIdentity').username, context.req.raw.signal),
    ),
  );
  app.get('/requests/:requestId', async (context) => {
    const username = context.get('assistantIdentity').username;
    const result = await service.host.status(
      username,
      requestId(username, context.req.param('requestId')),
    );
    if (!result) throw new AssistantApiError(404, 'not_found');
    return context.json(result);
  });
  app.get('/stream', (context) => stream(context, service, limits));
  return app;
}
