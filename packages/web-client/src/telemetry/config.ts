/**
 * OpenTelemetry configuration for browser RUM.
 *
 * Environment variables are injected by Vite at build time.
 * Prefix with VITE_ to expose to client code.
 */

/** Telemetry configuration interface */
export interface TelemetryConfig {
  /** Service name for traces */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Deployment environment (dev, staging, prod) */
  environment: string;
  /** OTLP endpoint URL for traces */
  tracesEndpoint: string;
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Log level for OTEL diagnostics */
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
}

/**
 * Creates telemetry configuration from environment variables.
 * @returns Telemetry configuration
 */
export function createTelemetryConfig(): TelemetryConfig {
  const isProduction = import.meta.env.PROD;

  return {
    serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME ?? 'eddo-web-client',
    serviceVersion: import.meta.env.VITE_OTEL_SERVICE_VERSION ?? '0.3.0',
    environment:
      import.meta.env.VITE_OTEL_ENVIRONMENT ?? (isProduction ? 'production' : 'development'),
    // Default to proxied endpoint through web-api to avoid CORS and API key exposure
    tracesEndpoint: import.meta.env.VITE_OTEL_TRACES_ENDPOINT ?? '/api/telemetry/v1/traces',
    enabled: import.meta.env.VITE_OTEL_ENABLED !== 'false',
    logLevel: (import.meta.env.VITE_OTEL_LOG_LEVEL as TelemetryConfig['logLevel']) ?? 'warn',
  };
}
