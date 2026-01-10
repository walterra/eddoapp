/**
 * OpenTelemetry Browser Tracer
 *
 * Provides distributed tracing for the web client using OpenTelemetry SDK.
 * Sends traces to EDOT Collector via a proxy endpoint to avoid exposing API keys.
 *
 * @see https://www.elastic.co/docs/solutions/observability/applications/otel-rum
 * @see https://opentelemetry.io/docs/languages/js/getting-started/browser/
 */

import type { Resource } from '@opentelemetry/resources';

import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { browserDetector } from '@opentelemetry/opentelemetry-browser-detector';
import { detectResources, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

import type { TelemetryConfig } from './config';
import { createTelemetryConfig } from './config';

/** Maps config log level to OTEL DiagLogLevel */
function getDiagLogLevel(level: TelemetryConfig['logLevel']): DiagLogLevel {
  const levels: Record<TelemetryConfig['logLevel'], DiagLogLevel> = {
    error: DiagLogLevel.ERROR,
    warn: DiagLogLevel.WARN,
    info: DiagLogLevel.INFO,
    debug: DiagLogLevel.DEBUG,
    verbose: DiagLogLevel.VERBOSE,
  };
  return levels[level] ?? DiagLogLevel.WARN;
}

/** Creates resource with service metadata and browser detection */
function createResource(config: TelemetryConfig): Resource {
  const detectedResources = detectResources({ detectors: [browserDetector] });
  const baseResource = resourceFromAttributes({
    'service.name': config.serviceName,
    'service.version': config.serviceVersion,
    'deployment.environment.name': config.environment,
  });
  return baseResource.merge(detectedResources);
}

/** Creates and configures tracer provider */
function createTracerProvider(config: TelemetryConfig, resource: Resource): WebTracerProvider {
  const exporter = new OTLPTraceExporter({ url: config.tracesEndpoint });

  // Configure batch processor with smaller batches to avoid Beacon API's 64KB limit
  // Default values are too large for browser environments
  const batchProcessor = new BatchSpanProcessor(exporter, {
    maxQueueSize: 100, // Max spans in queue (default: 2048)
    maxExportBatchSize: 10, // Max spans per export (default: 512)
    scheduledDelayMillis: 1000, // Export interval (default: 5000ms)
    exportTimeoutMillis: 30000, // Export timeout (default: 30000ms)
  });

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [batchProcessor],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new CompositePropagator({
      propagators: [new W3CBaggagePropagator(), new W3CTraceContextPropagator()],
    }),
  });

  return provider;
}

/** Registers automatic browser instrumentations */
function setupInstrumentations(): void {
  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation({
        ignoreNetworkEvents: false,
        ignorePerformancePaintEvents: false,
      }),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/^\/api\//, new RegExp(`^${window.location.origin}`)],
        clearTimingResources: true,
      }),
    ],
  });
}

/** Tracer provider instance */
let tracerProvider: WebTracerProvider | null = null;

/** Initialization state */
let initialized = false;

/**
 * Initializes OpenTelemetry tracing for the browser.
 *
 * Must be called once at application startup, before React renders.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export function initTelemetry(): void {
  if (initialized) {
    return;
  }

  const config = createTelemetryConfig();

  if (!config.enabled) {
    console.info('[Telemetry] Disabled via configuration');
    initialized = true;
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), getDiagLogLevel(config.logLevel));

  const resource = createResource(config);
  tracerProvider = createTracerProvider(config, resource);
  setupInstrumentations();

  diag.info('[Telemetry] Initialized', {
    serviceName: config.serviceName,
    environment: config.environment,
    tracesEndpoint: config.tracesEndpoint,
  });

  initialized = true;
}

/**
 * Gets a tracer instance for manual instrumentation.
 * @param name - Tracer name (defaults to service name)
 * @returns Tracer instance
 */
export function getTracer(name?: string) {
  const config = createTelemetryConfig();
  return trace.getTracer(name ?? config.serviceName);
}

/**
 * Shuts down telemetry and flushes pending spans.
 * Call during application cleanup if needed.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
    initialized = false;
  }
}
