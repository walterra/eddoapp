import { createEnv } from '@eddo/core-server';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { logger } from '../utils/logger';
import { buildTelemetryHeaders } from './telemetry_headers';

type TelemetrySignal = 'traces' | 'metrics' | 'logs';
type TelemetryConfig = Pick<
  ReturnType<typeof createEnv>,
  'OTEL_EXPORTER_OTLP_ENDPOINT' | 'OTEL_EXPORTER_OTLP_HEADERS' | 'OTEL_API_KEY'
>;
interface TelemetryDependencies {
  getConfig: () => TelemetryConfig;
  fetch: typeof globalThis.fetch;
  allowDefaultEndpoint?: boolean;
}

/** Validates generic HTTP endpoints without including configuration values in errors. */
function collectorEndpoint(endpoint: string, allowDefaultEndpoint: boolean): string | null {
  if (!endpoint || (endpoint === 'http://localhost:4318' && !allowDefaultEndpoint)) return null;
  const url = new URL(endpoint);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /\/v1\/(traces|metrics|logs)\/?$/.test(url.pathname)
  ) {
    throw new Error('Invalid generic OTLP endpoint');
  }
  return url.toString().replace(/\/$/, '');
}

/** Forwards OTLP JSON or protobuf bytes with server-side credentials and bounded requests. */
async function forwardTelemetry(
  context: Context,
  signal: TelemetrySignal,
  dependencies: TelemetryDependencies,
): Promise<Response> {
  // Let Hono's streaming body limiter handle read errors outside the exporter catch.
  const body = await context.req.arrayBuffer();
  if (body.byteLength > 1024 * 1024) return context.json({ error: 'Payload too large' }, 413);
  try {
    const config = dependencies.getConfig();
    const endpoint = collectorEndpoint(
      config.OTEL_EXPORTER_OTLP_ENDPOINT,
      dependencies.allowDefaultEndpoint ?? false,
    );
    if (!endpoint)
      return context.json(
        { status: 'ok', message: `OTEL not configured, ${signal} discarded` },
        200,
      );
    const contentType = context.req.header('Content-Type') ?? 'application/json';
    if (
      !['application/json', 'application/x-protobuf'].includes(contentType.split(';')[0].trim())
    ) {
      return context.json({ error: 'Unsupported OTLP content type' }, 415);
    }
    const response = await dependencies.fetch(`${endpoint}/v1/${signal}`, {
      method: 'POST',
      headers: buildTelemetryHeaders(config, contentType),
      body,
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch {
    // Exporter errors can contain credentials; never log the raw error or request headers.
    logger.warn({ signal }, 'Telemetry forwarding failed');
    return context.json({ error: 'Failed to send telemetry' }, 502);
  }
}

/** Creates a same-origin proxy without exposing collector credentials to browser clients. */
export function createTelemetryRoutes(
  dependencies: TelemetryDependencies = { getConfig: createEnv, fetch: globalThis.fetch },
): Hono {
  const app = new Hono();
  app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));
  for (const signal of ['traces', 'metrics', 'logs'] as const) {
    app.post(`/v1/${signal}`, (context) => forwardTelemetry(context, signal, dependencies));
  }
  return app;
}

export const telemetryRoutes = createTelemetryRoutes();
