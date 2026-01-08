/**
 * Telemetry Proxy Routes
 *
 * Proxies browser telemetry data to OTEL Collector.
 * This avoids exposing OTEL API keys in the browser and handles CORS.
 *
 * @see https://www.elastic.co/docs/solutions/observability/applications/otel-rum
 */

import { createEnv } from '@eddo/core-server';
import { Hono } from 'hono';

import { logger } from '../utils/logger';

const telemetryApp = new Hono();

/** Gets OTEL collector endpoint from environment */
function getOtelEndpoint(): string {
  const env = createEnv();
  return env.OTEL_EXPORTER_OTLP_ENDPOINT;
}

/** Gets optional OTEL API key from environment */
function getOtelApiKey(): string | undefined {
  const env = createEnv();
  return env.OTEL_API_KEY;
}

/** Builds headers for OTEL collector request */
function buildOtelHeaders(contentType: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': contentType ?? 'application/json',
  };

  const apiKey = getOtelApiKey();
  if (apiKey) {
    headers['Authorization'] = `ApiKey ${apiKey}`;
  }

  return headers;
}

/** Proxies request to OTEL collector */
async function proxyToOtel(
  endpoint: string,
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

/**
 * POST /api/telemetry/v1/traces
 * Proxies trace data to OTEL Collector
 */
telemetryApp.post('/v1/traces', async (c) => {
  const otelEndpoint = getOtelEndpoint();
  const tracesUrl = `${otelEndpoint}/v1/traces`;

  try {
    const body = await c.req.text();
    const headers = buildOtelHeaders(c.req.header('Content-Type'));

    logger.debug({ tracesUrl }, 'Proxying traces to OTEL collector');

    return await proxyToOtel(tracesUrl, body, headers);
  } catch (error) {
    logger.error({ error, tracesUrl }, 'Failed to proxy traces to OTEL collector');
    return c.json({ error: 'Failed to send telemetry' }, 502);
  }
});

/**
 * POST /api/telemetry/v1/metrics
 * Proxies metrics data to OTEL Collector
 */
telemetryApp.post('/v1/metrics', async (c) => {
  const otelEndpoint = getOtelEndpoint();
  const metricsUrl = `${otelEndpoint}/v1/metrics`;

  try {
    const body = await c.req.text();
    const headers = buildOtelHeaders(c.req.header('Content-Type'));

    logger.debug({ metricsUrl }, 'Proxying metrics to OTEL collector');

    return await proxyToOtel(metricsUrl, body, headers);
  } catch (error) {
    logger.error({ error, metricsUrl }, 'Failed to proxy metrics to OTEL collector');
    return c.json({ error: 'Failed to send telemetry' }, 502);
  }
});

/**
 * POST /api/telemetry/v1/logs
 * Proxies log data to OTEL Collector
 */
telemetryApp.post('/v1/logs', async (c) => {
  const otelEndpoint = getOtelEndpoint();
  const logsUrl = `${otelEndpoint}/v1/logs`;

  try {
    const body = await c.req.text();
    const headers = buildOtelHeaders(c.req.header('Content-Type'));

    logger.debug({ logsUrl }, 'Proxying logs to OTEL collector');

    return await proxyToOtel(logsUrl, body, headers);
  } catch (error) {
    logger.error({ error, logsUrl }, 'Failed to proxy logs to OTEL collector');
    return c.json({ error: 'Failed to send telemetry' }, 502);
  }
});

export { telemetryApp as telemetryRoutes };
