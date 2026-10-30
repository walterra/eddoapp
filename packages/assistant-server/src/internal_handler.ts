import { createHash, timingSafeEqual } from 'node:crypto';
import {
  internalAdmissionSchema,
  InternalAssistantError,
  internalPendingSchema,
  internalStatusSchema,
  MAX_INTERNAL_BODY_BYTES,
  type InternalAssistantOperations,
} from './internal_protocol.js';

export interface InternalHandlerOptions extends InternalAssistantOperations {
  token: string;
}

class InternalBodyError extends Error {
  constructor(readonly status: 400 | 413) {
    super('Invalid internal request body');
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Compares fixed-length digests without exposing the configured secret through timing or errors. */
function authorized(request: Request, token: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const digest = (value: string): Uint8Array =>
    new TextEncoder().encode(createHash('sha256').update(value).digest('hex'));
  return timingSafeEqual(digest(supplied), digest(token));
}

/** Bounds streamed bodies before parsing JSON, including requests without Content-Length. */
async function body(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new InternalBodyError(400);
  const reader = request.body?.getReader();
  if (!reader) throw new InternalBodyError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_INTERNAL_BODY_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new InternalBodyError(413);
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new InternalBodyError(400);
  }
}

function failure(error: unknown): Response {
  if (error instanceof InternalAssistantError) return json({ error: error.code }, error.status);
  if (error instanceof InternalBodyError)
    return json(
      { error: error.status === 413 ? 'body_too_large' : 'invalid_request' },
      error.status,
    );
  return json({ error: 'unavailable' }, 503);
}

/** Validates transport payloads separately from backend failures. */
async function dispatch(
  options: InternalHandlerOptions,
  path: string,
  input: unknown,
): Promise<Response> {
  if (path.endsWith('/pending')) {
    const parsed = internalPendingSchema.safeParse(input);
    if (!parsed.success) return json({ error: 'invalid_request' }, 400);
    return json(await options.pending(parsed.data));
  }
  if (path.endsWith('/admit')) {
    const parsed = internalAdmissionSchema.safeParse(input);
    if (!parsed.success) return json({ error: 'invalid_request' }, 400);
    return json(await options.admit(parsed.data), 202);
  }
  const parsed = internalStatusSchema.safeParse(input);
  if (!parsed.success) return json({ error: 'invalid_request' }, 400);
  const result = await options.status(parsed.data);
  return result ? json(result) : json({ error: 'not_found' }, 404);
}

/** Exposes only authenticated internal admission and persisted request status; never opens journals itself. */
export function createInternalAssistantHandler(
  options: InternalHandlerOptions,
): (request: Request) => Promise<Response> {
  if (options.token.length < 32)
    throw new Error('Internal assistant token requires at least 32 characters');
  return async (request) => {
    if (!authorized(request, options.token)) return json({ error: 'unauthorized' }, 401);
    const path = new URL(request.url).pathname;
    if (
      ![
        '/internal/assistant/admit',
        '/internal/assistant/status',
        '/internal/assistant/pending',
      ].includes(path)
    )
      return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try {
      return await dispatch(options, path, await body(request));
    } catch (error) {
      return failure(error);
    }
  };
}
